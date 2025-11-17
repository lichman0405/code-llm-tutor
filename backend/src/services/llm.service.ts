import axios from 'axios';
import { prisma } from '../lib/prisma';
import { decrypt } from '../utils/crypto';

/**
 * Extract JSON from LLM response
 * Handle Markdown code block format (```json ... ```)
 */
export function extractJSON(text: string): string {
  const trimmed = text.trim();
  
  // Try to match Markdown code block
  const jsonMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }
  
  return trimmed;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  tokens?: number;
}

export interface LLMConfig {
  provider: string;
  apiKey: string;
  baseURL: string;
  model: string;
  isUserConfig: boolean;
  userId?: string; // used for analytics
}

/**
 * Check if user LLM quota is exceeded
 */
async function checkQuota(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const config = await prisma.lLMConfig.findUnique({
    where: { userId },
  });

  if (!config) {
    return { allowed: true }; // No config, use system default
  }

  // Check whether monthly stats need to be reset
  const now = new Date();
  const lastReset = config.lastResetDate;
  
  if (!lastReset || lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
    // Reset monthly stats
    await prisma.lLMConfig.update({
      where: { userId },
      data: {
        monthlyRequests: 0,
        monthlyTokens: 0,
        lastResetDate: now,
        quotaExceeded: false,
      },
    });
    return { allowed: true };
  }

  // Check quota
  if (config.monthlyTokenQuota && config.monthlyTokens >= config.monthlyTokenQuota) {
    await prisma.lLMConfig.update({
      where: { userId },
      data: { quotaExceeded: true },
    });
    return {
      allowed: false,
      reason: `Monthly quota exhausted (${config.monthlyTokens}/${config.monthlyTokenQuota} tokens)`,
    };
  }

  return { allowed: true };
}

/**
 * Record LLM usage statistics
 */
async function recordUsage(userId: string | undefined, tokens: number) {
  if (!userId) return; // Do not record for system default config

  try {
    const config = await prisma.lLMConfig.findUnique({
      where: { userId },
    });

    if (!config) return;

    await prisma.lLMConfig.update({
      where: { userId },
      data: {
        totalRequests: { increment: 1 },
        totalTokens: { increment: tokens },
        monthlyRequests: { increment: 1 },
        monthlyTokens: { increment: tokens },
      },
    });
  } catch (error) {
    console.error('Failed to record LLM usage:', error);
  }
}

/**
 * Get user's LLM config (if any), otherwise return system default config
 */
export async function getUserLLMConfig(userId?: string): Promise<LLMConfig> {
  // Default system configuration
  const defaultConfig: LLMConfig = {
    provider: 'deepseek',
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.deepseek.com',
    model: process.env.OPENAI_MODEL || 'deepseek-chat',
    isUserConfig: false,
  };

  // If no userId is provided, return default config
  if (!userId) {
    return defaultConfig;
  }

  try {
    // Query user config
    const userConfig = await prisma.lLMConfig.findUnique({
      where: { userId },
    });

    if (!userConfig || !userConfig.apiKeyEncrypted) {
      return defaultConfig;
    }

    // Check monthly reset
    const currentMonth = new Date().toISOString().substring(0, 7); // "2025-11"
    const lastResetMonth = userConfig.lastResetDate?.toISOString().substring(0, 7);
    
    if (!lastResetMonth || lastResetMonth !== currentMonth) {
      console.log(`Resetting monthly stats for user ${userId}`);
      await prisma.lLMConfig.update({
        where: { userId },
        data: {
          monthlyTokens: 0,
          monthlyRequests: 0,
          lastResetDate: new Date(),
          quotaExceeded: false,
        },
      });
      // Update values in memory
      userConfig.monthlyTokens = 0;
      userConfig.monthlyRequests = 0;
      userConfig.quotaExceeded = false;
    }

    // Check if quota exceeded (use the correct field names)
    if (userConfig.monthlyTokenQuota && userConfig.monthlyTokenQuota > 0) {
      if (userConfig.monthlyTokens >= userConfig.monthlyTokenQuota) {
        console.warn(`User ${userId} exceeded monthly quota (${userConfig.monthlyTokens}/${userConfig.monthlyTokenQuota}), using default config`);
        
        // Mark quota as exceeded
        if (!userConfig.quotaExceeded) {
          await prisma.lLMConfig.update({
            where: { userId },
            data: { quotaExceeded: true },
          });
        }
        
        return defaultConfig;
      }
    }

    // Decrypt API key
    const apiKey = decrypt(userConfig.apiKeyEncrypted);
    
    // Determine baseURL and model based on provider
    let baseURL = userConfig.baseUrl || '';
    let model = userConfig.model || '';
    
    if (userConfig.provider === 'openai') {
      baseURL = baseURL || 'https://api.openai.com';
      model = model || 'gpt-3.5-turbo';
    } else if (userConfig.provider === 'anthropic') {
      baseURL = baseURL || 'https://api.anthropic.com';
      model = model || 'claude-3-haiku-20240307';
    } else if (userConfig.provider === 'custom') {
      // Custom provider must provide baseURL and model
      if (!baseURL || !model) {
        console.warn(`User ${userId} custom LLM config incomplete, using default`);
        return defaultConfig;
      }
    }

    return {
      provider: userConfig.provider,
      apiKey,
      baseURL,
      model,
      isUserConfig: true,
    };
  } catch (error) {
    console.error('Error fetching user LLM config:', error);
    return defaultConfig;
  }
}

/**
 * LLM Service - supports user-level configuration
 */
class LLMService {
  private config: LLMConfig;
  private userId?: string;

  constructor(config: LLMConfig, userId?: string) {
    this.config = config;
    this.userId = userId;
  }

  /**
   * Get current configuration info
   */
  getConfigInfo() {
    return {
      provider: this.config.provider,
      model: this.config.model,
      baseURL: this.config.baseURL,
      isUserConfig: this.config.isUserConfig,
    };
  }

  /**
   * Call LLM to generate a response
   */
  async chat(messages: LLMMessage[], temperature = 0.7, maxTokens = 2000): Promise<LLMResponse> {
    try {
      const response = await axios.post(
        `${this.config.baseURL}/v1/chat/completions`,
        {
          model: this.config.model,
          messages,
          temperature,
          max_tokens: maxTokens,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
        }
      );

      const choice = response.data.choices[0];
      const result = {
        content: choice.message.content,
        tokens: response.data.usage?.total_tokens || 0,
      };

      // Update user LLM usage stats (if using user-level config)
      if (this.config.isUserConfig && this.userId && result.tokens > 0) {
        try {
          await prisma.lLMConfig.update({
            where: { userId: this.userId },
            data: {
              totalRequests: { increment: 1 },
              totalTokens: { increment: result.tokens },
              monthlyRequests: { increment: 1 },
              monthlyTokens: { increment: result.tokens },
            },
          });
        } catch (error) {
          console.error('Failed to update LLM usage stats:', error);
          // Stats update failure does not impact the main flow
        }
      }

      return result;
    } catch (error: any) {
      console.error('LLM API Error:', error.response?.data || error.message);
      throw new Error('LLM API call failed');
    }
  }

  /**
   * Generate problem
   */
  async generateProblem(
    difficulty: number, 
    algorithmTypes: string[], 
    userLevel: number,
    proficiency?: Record<string, number>
  ): Promise<string> {
    const proficiencyInfo = proficiency && Object.keys(proficiency).length > 0
      ? `\nProficiency info: ${JSON.stringify(proficiency)} (please design the problem to target weaknesses)`
      : '';

    // Add timestamp and random seed to ensure a unique problem each time
    const timestamp = Date.now();
    const randomSeed = Math.floor(Math.random() * 1000000);
    
    // Randomly select a theme to ensure diversity
    const themes = [
      'stock trading', 'matrix path', 'string processing', 'tree structures', 'linked list operations',
      'array operations', 'hash table applications', 'stack and queue', 'binary search', 'sorting algorithms',
      'range problems', 'bitwise operations', 'math problems', 'geometry problems', 'game theory',
      'knapsack problems', 'string matching', 'graph traversal', 'shortest path', 'topological sort',
      'union-find', 'segment tree', 'prefix sum', 'sliding window', 'two pointers',
      'backtracking', 'divide and conquer', 'greedy algorithms', 'dynamic programming', 'bitmask DP'
    ];
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    
    const prompt = `You are an expert algorithm problem generator. Generate an entirely new, unique algorithm problem with difficulty ${difficulty}/10.

Key requirements (must strictly follow):
1. Generated ID: ${timestamp}-${randomSeed}
2. **Problem theme must be centered around: ${randomTheme}**
3. Algorithm types: ${algorithmTypes.join(', ')}
4. Target level: ${userLevel}/10 learner${proficiencyInfo}

Creative requirements:
- The problem title must be related to "${randomTheme}", avoid clichéd themes such as candy, games, etc.
- The problem background should be innovative; avoid common motifs like city, collection, street, etc.
- Data structures and solution approach should be novel.
- Problem must be solvable; test cases must be accurate.

Format requirements:
Return as JSON with the following fields:
{
  "title": "Problem title (must include theme keywords)",
  "description": "Problem description (detailed and creative)",
  "inputFormat": "Input format description",
  "outputFormat": "Output format description",
  "examples": [{"input": "example input", "output": "example output", "explanation": "explanation"}],
  "testCases": [{"input": "test input", "output": "expected output"}],
  "hints": ["hint1", "hint2", "hint3"],
  "timeComplexity": "expected time complexity",
  "spaceComplexity": "expected space complexity"
}`;

    const response = await this.chat([
      { role: 'system', content: `You are a professional algorithm problem generator assistant. You must only return valid JSON, do not wrap content in Markdown code blocks, and do not add any extra explanatory text.

    Core principles:
    1. Each call must generate a completely different problem.
    2. Strictly follow the user-specified theme.
    3. Avoid reusing similar scenes, vocabulary, and structures.
    4. The problem must make sense and be solvable.` },
      { role: 'user', content: prompt }
    ], 1.0, 3000); // temperature set to 1.0 to maximize randomness

    return response.content;
  }

  /**
   * Warm-up conversation assessment
   */
  async warmupChat(conversationHistory: LLMMessage[], userMessage: string): Promise<LLMResponse> {
    const systemPrompt = `You are a friendly yet efficient algorithm learning assistant. You are conducting a warm-up conversation with the user to assess their algorithmic skill level.

Conversation goals:
1. Understand the user's learning goals (interview preparation / learning for interest / contest)
2. Assess the user's current level (1-10)
3. Understand the algorithm types the user is familiar with
4. Understand the user's preferred programming languages (Python/JavaScript/Go/Java/C++/Rust, etc.)
5. Determine which algorithm categories the user needs to focus on

Important rules:
- Ask questions naturally, avoid asking too many at once
- Deepen follow-up questions based on user's responses
- Typically, 3-5 dialogue turns are sufficient to collect enough information
- When you have understood the user's learning goals, background and algorithm foundation, immediately end the conversation
- When the user says "OK", "sure", "I'm ready", "start", "assess", or similar to indicate consent, you must immediately output the assessment
- Do not ask whether the user wants practice after the assessment; the assessment ends the warmup

Assessment output format (must strictly follow):
When you decide to provide the assessment, you must append the following to the end of the reply:

###ASSESSMENT###
```json
{
  "level": 5,
  "learningGoal": "interview",
  "algorithmProficiency": {"array": 7, "tree": 5, "graph": 3, "dp": 2, "sorting": 8, "searching": 7},
  "recommendedStartLevel": 4,
  "preferredLanguages": ["go", "python"],
  "summary": "Assessment summary"
}
```

Example:
User: "OK, let's start"
Assistant: "Understood! Based on our conversation, I have the following summary for you.

###ASSESSMENT###
```json
{
  "level": 6,
  "learningGoal": "interest",
  "algorithmProficiency": {"array": 7, "tree": 6, "graph": 5, "dp": 4, "sorting": 8, "searching": 7},
  "recommendedStartLevel": 5,
  "preferredLanguages": ["rust", "c++"],
  "summary": "Experienced C/C++ developer with a solid algorithm foundation. Current goal is to learn Rust through algorithm practice."
}
```

Remember: The ###ASSESSMENT### marker is required; otherwise the system will not recognize completion of the assessment!`;

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    return await this.chat(messages, 0.7, 1000);
  }

  /**
   * Generate graded hints
   */
  async generateHint(
    problemDescription: string,
    userCode: string,
    hintLevel: number,
    language: string = 'python'
  ): Promise<string> {
    let systemPrompt = '';
    let userPrompt = '';

    // Level 1: Conceptual hint - only give direction, no concrete method
    if (hintLevel === 1) {
      systemPrompt = 'You are an algorithm tutor. For Level 1 hints, only provide direction and key questions; do not mention specific algorithm names, data structures, or code implementations.';
      userPrompt = `Problem:
${problemDescription}

User's current code:
\`\`\`
${userCode || '(user has not written code yet)'}
\`\`\`

Please provide a **Level 1 conceptual hint**, requirements:
1. Use 2-3 thought-provoking questions to guide the user's thinking
2. Do not mention specific algorithm names (e.g., 'dynamic programming', 'greedy')
3. Do not suggest specific data structures
4. Only hint at key problem features and possible ways of thinking
5. Keep within 100 words

Example format:
"Consider:
- What is the core of this problem?
- Can you find any repeated computations in the problem?
- Starting from the simplest case, how would you approach it?"`;
    }
    
    // Level 2: Framework hint - give algorithm direction and main steps
    else if (hintLevel === 2) {
      systemPrompt = 'You are an algorithm tutor. For Level 2 hints, you may mention algorithm types and overall approach, but do not provide implementation details or code.';
      userPrompt = `Problem:
${problemDescription}

User's current code:
\`\`\`
${userCode || '(user has not written code yet)'}
\`\`\`

Please provide a **Level 2 framework hint**, requirements:
1. Clearly indicate suitable algorithm types (e.g., dynamic programming, greedy, two pointers)
2. Provide the 3-5 main algorithm steps (no implementation details)
3. Suggest the required data structures
4. Do not provide pseudocode or code excerpts
5. Keep within 200 words

Example format:
"Algorithm direction: [algorithm types]

Main steps:
1. [Step 1 description]
2. [Step 2 description]
3. [Step 3 description]

Required data structures: [data structure name]"`;
    }
    
    // Level 3: Pseudocode hint - provide detailed pseudocode logic
    else if (hintLevel === 3) {
      systemPrompt = 'You are an algorithm tutor. For Level 3 hints, provide clear pseudocode and detailed algorithmic logic, but do not provide runnable code.';
      userPrompt = `Problem:
${problemDescription}

User's current code:
\`\`\`
${userCode || '(user has not written code yet)'}
\`\`\`

Please provide a **Level 3 pseudocode hint**, requirements:
1. Describe the complete algorithm flow in pseudocode
2. Include all key steps and edge case handling
3. Explain the meaning and initialization of variables
4. Use a mix of natural language and pseudocode; avoid specific programming language syntax
5. Keep within 300 words

Example format:
"Algorithm implementation idea:

Initialization:
- Create array dp of size n
- dp[0] = initial value

Iteration process:
For i from 1 to n-1:
    If [condition]:
        dp[i] = [calculation method 1]
    Else:
        dp[i] = [calculation method 2]

Return: dp[n-1]"`;
    }
    
    // Level 4: Code snippet hint - provide key code fragments
    else {
      // Adjust code examples based on language
      const languageMap: Record<string, { name: string; comment: string; example: string }> = {
        python: {
          name: 'Python',
          comment: '#',
          example: `\`\`\`python
def solution(input):
    # Initialization
    result = []
    
    # Main logic
    for item in input:
        # TODO: please complete this part - process each element
        pass
    
    return result
\`\`\``
        },
        javascript: {
          name: 'JavaScript',
          comment: '//',
          example: `\`\`\`javascript
function solution(input) {
    // Initialization
    let result = [];
    
    // Main logic
    for (let item of input) {
        // TODO: please complete this part - process each element
    }
    
    return result;
}
\`\`\``
        },
        typescript: {
          name: 'TypeScript',
          comment: '//',
          example: `\`\`\`typescript
function solution(input: any[]): any[] {
    // Initialization
    let result: any[] = [];
    
    // Main logic
    for (let item of input) {
      // TODO: please complete this part - process each element
    }
    
    return result;
}
\`\`\``
        },
        java: {
          name: 'Java',
          comment: '//',
          example: `\`\`\`java
public static List<Object> solution(List<Object> input) {
    // Initialization
    List<Object> result = new ArrayList<>();
    
    // Main logic
    for (Object item : input) {
      // TODO: please complete this part - process each element
    }
    
    return result;
}
\`\`\``
        },
        cpp: {
          name: 'C++',
          comment: '//',
          example: `\`\`\`cpp
vector<int> solution(vector<int>& input) {
    // Initialization
    vector<int> result;
    
    // Main logic
    for (int item : input) {
      // TODO: please complete this part - process each element
    }
    
    return result;
}
\`\`\``
        }
      };

      const langConfig = languageMap[language] || languageMap['python'];
      
      systemPrompt = `You are an algorithm tutor. For Level 4 hints, provide near-complete ${langConfig.name} code implementations, but leave 1-2 key parts for the user to complete.`;
      userPrompt = `Problem:
${problemDescription}

User's current code:
\`\`\`
${userCode || '(user has not written code yet)'}
\`\`\`

Please provide a **Level 4 code fragment hint**, requirements:
1. Provide 70-80% of the code implementation
2. Leave 1-2 key parts for the user to fill in (annotate with "${langConfig.comment} TODO: please complete this part")
3. Include a complete function definition and main logic
4. Add necessary comments
5. Use ${langConfig.name}
6. Keep within 400 words

Example format:
${langConfig.example}`;
    }

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], 0.7, 1000);

    return response.content;
  }

  /**
   * Analyze code quality
   */
  async analyzeCode(code: string, language: string, problemDescription: string): Promise<any> {
    const prompt = `Please analyze the quality of the following ${language} code:

Problem:
${problemDescription}

Code:

\`\`\`${language}
${code}
\`\`\`

Please rate on the following dimensions (0-10):
1. Time complexity
2. Space complexity
3. Code readability
4. Code style
5. Edge case handling

Return in JSON format:
{
  "timeComplexity": {"score": 8, "actual": "O(n)", "optimal": "O(n)"},
  "spaceComplexity": {"score": 7, "actual": "O(n)", "optimal": "O(1)"},
  "readability": 8,
  "codeStyle": 9,
  "edgeCases": 7,
  "overallScore": 8,
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}`;

    const response = await this.chat([
      { role: 'system', content: 'You are a professional code review expert. You must only return valid JSON, do not wrap responses in Markdown code blocks, and do not add any explanatory text.' },
      { role: 'user', content: prompt }
    ], 0.5, 1500);

    return response.content;
  }
}

/**
 * Create LLM service instance (supports user-level configuration)
 * @param userId User ID; if provided, use user-specific config; otherwise use system default
 */
export async function createLLMService(userId?: string): Promise<LLMService> {
  const config = await getUserLLMConfig(userId);
  return new LLMService(config, userId);
}

// Export default instance (for backward compatibility, uses system default config)
export const llmService = new LLMService({
  provider: 'deepseek',
  apiKey: process.env.OPENAI_API_KEY || '',
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.deepseek.com',
  model: process.env.OPENAI_MODEL || 'deepseek-chat',
  isUserConfig: false,
});
