import axios from 'axios';
import { prisma } from '../lib/prisma';
import { decrypt } from '../utils/crypto';

/**
 * 从 LLM 响应中提取 JSON
 * 处理 Markdown 代码块格式 (```json ... ```)
 */
export function extractJSON(text: string): string {
  const trimmed = text.trim();
  
  // 尝试匹配 Markdown 代码块
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
  userId?: string; // 用于统计
}

/**
 * 检查用户LLM配额是否超限
 */
async function checkQuota(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const config = await prisma.lLMConfig.findUnique({
    where: { userId },
  });

  if (!config) {
    return { allowed: true }; // 没有配置,使用系统默认
  }

  // 检查是否需要重置月度统计
  const now = new Date();
  const lastReset = config.lastResetDate;
  
  if (!lastReset || lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
    // 重置月度统计
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

  // 检查配额
  if (config.monthlyTokenQuota && config.monthlyTokens >= config.monthlyTokenQuota) {
    await prisma.lLMConfig.update({
      where: { userId },
      data: { quotaExceeded: true },
    });
    return {
      allowed: false,
      reason: `月度配额已用尽 (${config.monthlyTokens}/${config.monthlyTokenQuota} tokens)`,
    };
  }

  return { allowed: true };
}

/**
 * 记录LLM使用统计
 */
async function recordUsage(userId: string | undefined, tokens: number) {
  if (!userId) return; // 系统默认配置不记录

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
 * 获取用户的LLM配置(如果有),否则返回系统默认配置
 */
export async function getUserLLMConfig(userId?: string): Promise<LLMConfig> {
  // 系统默认配置
  const defaultConfig: LLMConfig = {
    provider: 'deepseek',
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.deepseek.com',
    model: process.env.OPENAI_MODEL || 'deepseek-chat',
    isUserConfig: false,
  };

  // 如果没有提供userId,返回默认配置
  if (!userId) {
    return defaultConfig;
  }

  try {
    // 查询用户配置
    const userConfig = await prisma.lLMConfig.findUnique({
      where: { userId },
    });

    if (!userConfig || !userConfig.apiKeyEncrypted) {
      return defaultConfig;
    }

    // 检查月度重置
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
      // 更新内存中的值
      userConfig.monthlyTokens = 0;
      userConfig.monthlyRequests = 0;
      userConfig.quotaExceeded = false;
    }

    // 检查配额是否超限 (使用正确的字段名)
    if (userConfig.monthlyTokenQuota && userConfig.monthlyTokenQuota > 0) {
      if (userConfig.monthlyTokens >= userConfig.monthlyTokenQuota) {
        console.warn(`User ${userId} exceeded monthly quota (${userConfig.monthlyTokens}/${userConfig.monthlyTokenQuota}), using default config`);
        
        // 标记配额超限
        if (!userConfig.quotaExceeded) {
          await prisma.lLMConfig.update({
            where: { userId },
            data: { quotaExceeded: true },
          });
        }
        
        return defaultConfig;
      }
    }

    // 解密API Key
    const apiKey = decrypt(userConfig.apiKeyEncrypted);
    
    // 根据provider确定baseURL和model
    let baseURL = userConfig.baseUrl || '';
    let model = userConfig.model || '';
    
    if (userConfig.provider === 'openai') {
      baseURL = baseURL || 'https://api.openai.com';
      model = model || 'gpt-3.5-turbo';
    } else if (userConfig.provider === 'anthropic') {
      baseURL = baseURL || 'https://api.anthropic.com';
      model = model || 'claude-3-haiku-20240307';
    } else if (userConfig.provider === 'custom') {
      // 自定义provider必须提供baseURL和model
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
 * LLM Service - 支持用户级配置
 */
class LLMService {
  private config: LLMConfig;
  private userId?: string;

  constructor(config: LLMConfig, userId?: string) {
    this.config = config;
    this.userId = userId;
  }

  /**
   * 获取当前使用的配置信息
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
   * 调用 LLM 生成回复
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

      // 更新用户LLM使用统计(如果是用户配置)
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
          // 统计更新失败不影响主流程
        }
      }

      return result;
    } catch (error: any) {
      console.error('LLM API Error:', error.response?.data || error.message);
      throw new Error('LLM API 调用失败');
    }
  }

  /**
   * 生成题目
   */
  async generateProblem(
    difficulty: number, 
    algorithmTypes: string[], 
    userLevel: number,
    proficiency?: Record<string, number>
  ): Promise<string> {
    const proficiencyInfo = proficiency && Object.keys(proficiency).length > 0
      ? `\n3. 用户算法熟练度: ${JSON.stringify(proficiency)} (请针对薄弱项设计题目)`
      : '';

    // 添加时间戳和随机数确保每次生成不同的题目
    const timestamp = Date.now();
    const randomSeed = Math.floor(Math.random() * 1000000);
    
    // 随机选择题目场景主题（确保多样性）
    const themes = [
      '股票交易', '矩阵路径', '字符串处理', '树形结构', '链表操作',
      '数组操作', '哈希表应用', '栈和队列', '二分查找', '排序算法',
      '区间问题', '位运算', '数学问题', '几何问题', '博弈论',
      '背包问题', '字符串匹配', '图的遍历', '最短路径', '拓扑排序',
      '并查集', '线段树', '前缀和', '滑动窗口', '双指针',
      '回溯算法', '分治算法', '贪心算法', '动态规划', '状态压缩'
    ];
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    
    const prompt = `你是一个算法题目生成专家。请生成一道**全新的、独特的**难度为 ${difficulty}/10 的算法题目。

【关键要求 - 必须严格遵守】
1. 生成ID: ${timestamp}-${randomSeed}
2. **题目主题必须围绕: ${randomTheme}**
3. 算法类型: ${algorithmTypes.join('、')}
4. 适合水平: ${userLevel}/10 的学习者${proficiencyInfo}

【创意要求】
- 题目标题必须与"${randomTheme}"相关，不要使用糖果、游戏等老套场景
- 题目背景要创新，避免使用城市、收集、街道等常见词汇
- 数据结构和解题思路要有新意
- 题目必须实际可解，测试用例要准确

【格式要求】
请以 JSON 格式返回,包含以下字段:
{
  "title": "题目标题(必须包含主题关键词)",
  "description": "题目描述(详细且创新)",
  "inputFormat": "输入格式说明",
  "outputFormat": "输出格式说明",
  "examples": [{"input": "示例输入", "output": "示例输出", "explanation": "解释"}],
  "testCases": [{"input": "测试输入", "output": "期望输出"}],
  "hints": ["提示1", "提示2", "提示3"],
  "timeComplexity": "期望时间复杂度",
  "spaceComplexity": "期望空间复杂度"
}`;

    const response = await this.chat([
      { role: 'system', content: `你是一个专业的算法题目生成助手。你必须只返回有效的 JSON 格式,不要使用 Markdown 代码块包裹,不要添加任何解释文字。

【核心原则】
1. 每次调用必须生成完全不同的题目
2. 严格按照用户指定的主题生成题目
3. 避免重复使用相似的场景、词汇、结构
4. 题目必须有实际意义和可解性` },
      { role: 'user', content: prompt }
    ], 1.0, 3000); // temperature设为1.0最大化随机性

    return response.content;
  }

  /**
   * Warm-up 对话评估
   */
  async warmupChat(conversationHistory: LLMMessage[], userMessage: string): Promise<LLMResponse> {
    const systemPrompt = `你是一个友好但高效的算法学习助手,正在与用户进行 warm-up 对话,评估他们的算法能力水平。

对话目标:
1. 了解用户的学习目标 (面试准备/兴趣学习/竞赛)
2. 评估用户的当前水平 (1-10)
3. 了解用户熟悉的算法类型
4. 了解用户的编程语言偏好 (Python/JavaScript/Go/Java/C++/Rust 等)
5. 了解用户在哪些算法类型上需要重点练习

**重要规则**:
- 请自然地提问,不要一次问太多问题
- 根据用户的回答逐步深入
- **通常 3-5 轮对话即可收集足够信息**
- 当你已经了解了用户的学习目标、技术背景、算法基础后,**立即主动结束对话**
- 用户说"可以"、"行"、"好的"、"开始吧"、"评估吧"等表示同意时,**必须立即输出评估结果**
- 不要在评估后继续询问用户是否需要练习,评估即代表 warmup 结束

**评估输出格式** (必须严格遵守):
当你决定给出评估时,必须在回复的最后加上:

###ASSESSMENT###
\`\`\`json
{
  "level": 5,
  "learningGoal": "interview",
  "algorithmProficiency": {"array": 7, "tree": 5, "graph": 3, "dp": 2, "sorting": 8, "searching": 7},
  "recommendedStartLevel": 4,
  "preferredLanguages": ["go", "python"],
  "summary": "评估总结"
}
\`\`\`

**示例**:
用户: "可以开始了"
助手: "明白了！根据我们的对话，我已经了解了你的情况。

###ASSESSMENT###
\`\`\`json
{
  "level": 6,
  "learningGoal": "interest",
  "algorithmProficiency": {"array": 7, "tree": 6, "graph": 5, "dp": 4, "sorting": 8, "searching": 7},
  "recommendedStartLevel": 5,
  "preferredLanguages": ["rust", "c++"],
  "summary": "资深C/C++开发者,具备扎实的算法基础。当前目标是结合算法实践来学习Rust语言。"
}
\`\`\`

记住: ###ASSESSMENT### 标记是必须的,否则系统无法识别评估完成!`;

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    return await this.chat(messages, 0.7, 1000);
  }

  /**
   * 生成分级提示
   */
  async generateHint(
    problemDescription: string,
    userCode: string,
    hintLevel: number,
    language: string = 'python'
  ): Promise<string> {
    let systemPrompt = '';
    let userPrompt = '';

    // Level 1: 思路提示 - 只给方向,不给具体方法
    if (hintLevel === 1) {
      systemPrompt = '你是一个算法导师。给出 Level 1 提示时,只能提供思考方向和关键问题,绝不能提及具体算法名称、数据结构或代码实现。';
      userPrompt = `题目:
${problemDescription}

用户当前代码:
\`\`\`
${userCode || '(用户还未编写代码)'}
\`\`\`

请给出 **Level 1 思路提示**,要求:
1. 用 2-3 个启发性问题引导用户思考
2. 不要提及具体算法名称(如"动态规划"、"贪心"等)
3. 不要给出数据结构建议
4. 只提示问题的关键特征和可能的思考角度
5. 控制在 100 字以内

示例格式:
"考虑一下:
- 这个问题的核心是什么?
- 你能找到问题中的重复计算吗?
- 从最简单的情况开始,你会怎么做?"`;
    }
    
    // Level 2: 框架提示 - 给出算法方向和大致步骤
    else if (hintLevel === 2) {
      systemPrompt = '你是一个算法导师。给出 Level 2 提示时,可以提及算法类型和整体思路,但不要给出具体实现细节或代码。';
      userPrompt = `题目:
${problemDescription}

用户当前代码:
\`\`\`
${userCode || '(用户还未编写代码)'}
\`\`\`

请给出 **Level 2 框架提示**,要求:
1. 明确指出适合的算法类型(如动态规划、贪心、双指针等)
2. 给出算法的 3-5 个主要步骤(不要具体实现)
3. 提示需要的数据结构
4. 不要给出伪代码或代码片段
5. 控制在 200 字以内

示例格式:
"算法方向: [算法类型]

主要步骤:
1. [步骤1描述]
2. [步骤2描述]
3. [步骤3描述]

需要的数据结构: [数据结构名称]"`;
    }
    
    // Level 3: 伪代码提示 - 给出详细的伪代码逻辑
    else if (hintLevel === 3) {
      systemPrompt = '你是一个算法导师。给出 Level 3 提示时,提供清晰的伪代码和详细的算法逻辑,但不要给出可直接运行的代码。';
      userPrompt = `题目:
${problemDescription}

用户当前代码:
\`\`\`
${userCode || '(用户还未编写代码)'}
\`\`\`

请给出 **Level 3 伪代码提示**,要求:
1. 用伪代码描述完整算法流程
2. 包含所有关键步骤和边界条件处理
3. 说明变量的含义和初始化
4. 用自然语言 + 伪代码混合表达,不要用具体编程语言语法
5. 控制在 300 字以内

示例格式:
"算法实现思路:

初始化:
- 创建数组 dp, 大小为 n
- dp[0] = 初始值

遍历过程:
对于 i 从 1 到 n-1:
    如果 [条件]:
        dp[i] = [计算方式1]
    否则:
        dp[i] = [计算方式2]

返回: dp[n-1]"`;
    }
    
    // Level 4: 代码片段提示 - 给出关键代码片段
    else {
      // 根据语言调整代码示例
      const languageMap: Record<string, { name: string; comment: string; example: string }> = {
        python: {
          name: 'Python',
          comment: '#',
          example: `\`\`\`python
def solution(input):
    # 初始化
    result = []
    
    # 主要逻辑
    for item in input:
        # TODO: 你来完成这部分 - 处理每个元素
        pass
    
    return result
\`\`\``
        },
        javascript: {
          name: 'JavaScript',
          comment: '//',
          example: `\`\`\`javascript
function solution(input) {
    // 初始化
    let result = [];
    
    // 主要逻辑
    for (let item of input) {
        // TODO: 你来完成这部分 - 处理每个元素
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
    // 初始化
    let result: any[] = [];
    
    // 主要逻辑
    for (let item of input) {
        // TODO: 你来完成这部分 - 处理每个元素
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
    // 初始化
    List<Object> result = new ArrayList<>();
    
    // 主要逻辑
    for (Object item : input) {
        // TODO: 你来完成这部分 - 处理每个元素
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
    // 初始化
    vector<int> result;
    
    // 主要逻辑
    for (int item : input) {
        // TODO: 你来完成这部分 - 处理每个元素
    }
    
    return result;
}
\`\`\``
        }
      };

      const langConfig = languageMap[language] || languageMap['python'];
      
      systemPrompt = `你是一个算法导师。给出 Level 4 提示时,提供接近完整的 ${langConfig.name} 代码实现,但保留部分让用户自己完成。`;
      userPrompt = `题目:
${problemDescription}

用户当前代码:
\`\`\`
${userCode || '(用户还未编写代码)'}
\`\`\`

请给出 **Level 4 代码片段提示**,要求:
1. 给出 70-80% 的代码实现
2. 保留 1-2 个关键部分让用户填充(用注释标注 "${langConfig.comment} TODO: 你来完成这部分")
3. 包含完整的函数定义和主要逻辑
4. 添加必要的注释说明
5. 使用 ${langConfig.name} 语言
6. 控制在 400 字以内

示例格式:
${langConfig.example}`;
    }

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], 0.7, 1000);

    return response.content;
  }

  /**
   * 分析代码质量
   */
  async analyzeCode(code: string, language: string, problemDescription: string): Promise<any> {
    const prompt = `请分析以下 ${language} 代码的质量:

题目:
${problemDescription}

代码:
\`\`\`${language}
${code}
\`\`\`

请从以下维度评分 (0-10):
1. 时间复杂度
2. 空间复杂度
3. 代码可读性
4. 代码规范性
5. 边界处理

返回 JSON 格式:
{
  "timeComplexity": {"score": 8, "actual": "O(n)", "optimal": "O(n)"},
  "spaceComplexity": {"score": 7, "actual": "O(n)", "optimal": "O(1)"},
  "readability": 8,
  "codeStyle": 9,
  "edgeCases": 7,
  "overallScore": 8,
  "suggestions": ["建议1", "建议2"]
}`;

    const response = await this.chat([
      { role: 'system', content: '你是一个专业的代码审查专家。你必须只返回有效的 JSON 格式,不要使用 Markdown 代码块包裹,不要添加任何解释文字。' },
      { role: 'user', content: prompt }
    ], 0.5, 1500);

    return response.content;
  }
}

/**
 * 创建LLM服务实例(支持用户级配置)
 * @param userId 用户ID,如果提供则使用用户配置,否则使用系统默认
 */
export async function createLLMService(userId?: string): Promise<LLMService> {
  const config = await getUserLLMConfig(userId);
  return new LLMService(config, userId);
}

// 导出默认实例(用于向后兼容,使用系统默认配置)
export const llmService = new LLMService({
  provider: 'deepseek',
  apiKey: process.env.OPENAI_API_KEY || '',
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.deepseek.com',
  model: process.env.OPENAI_MODEL || 'deepseek-chat',
  isUserConfig: false,
});
