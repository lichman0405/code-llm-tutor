# Technical Design Document
# LLM-Driven Adaptive Algorithm Learning Platform

**Version**: 1.0
**Creation Date**: 2024-11-04

---

## 1. System Architecture

### 1.1 Overall Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        User Layer                           │
│                   (Web Browser)                             │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────────┐
│                     Frontend Layer                          │
│   Next.js 14 + React 18 + TypeScript                        │
│   UI: Shadcn/ui + Tailwind CSS                              │
│   Editor: Monaco Editor                                     │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API / WebSocket
┌────────────────────────▼────────────────────────────────────┐
│                     Backend Layer                           │
│   Node.js 20 + Express.js + TypeScript                      │
│                                                            │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│   │ Auth Service │  │ LLM Service  │  │ Code Service │    │
│   └──────────────┘  └──────────────┘  └──────────────┘    │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│   │ User Service │  │ Problem Svc  │  │ Eval Service │    │
│   └──────────────┘  └──────────────┘  └──────────────┘    │
└───────┬──────────────────┬──────────────────┬──────────────┘
        │                  │                  │
        │ PostgreSQL       │ LLM APIs         │ gRPC
        │                  │                  │
┌───────▼──────────┐  ┌───▼──────────┐  ┌───▼──────────┐
│   Database Layer │  │ External Services│  │ Executor Layer │
│   PostgreSQL 16  │  │ OpenAI         │  │ Judge0 CE      │
│   Redis 7        │  │ Anthropic      │  │ (Docker)       │
└──────────────────┘  └──────────────┘  └──────────────┘
```

### 1.2 Technology Stack Selection

#### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **UI Library**: Shadcn/ui + Radix UI
- **Styling**: Tailwind CSS 3
- **State Management**: Zustand
- **Code Editor**: Monaco Editor (Same as VS Code)
- **Charts**: Recharts
- **HTTP Client**: Axios
- **Form Validation**: Zod + React Hook Form

#### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js 4
- **Language**: TypeScript 5
- **ORM**: Prisma 5
- **Authentication**: JWT + bcrypt
- **Validation**: Zod
- **Logging**: Winston
- **API Documentation**: Swagger/OpenAPI

#### Database
- **Primary Database**: PostgreSQL 16
- **Cache**: Redis 7
- **ORM**: Prisma

#### Code Execution
- **Solution**: Judge0 CE (Open-source code execution engine)
- **Containerization**: Docker + Docker Compose
- **Isolation**: Independent container per execution

#### DevOps
- **Container**: Docker + Docker Compose
- **Version Control**: Git + GitHub
- **CI/CD**: GitHub Actions (Optional)

---

## 2. Database Design

### 2.1 ER Diagram Overview

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│    Users    │────┬───<│ Submissions │>───┬────│  Problems   │
└─────────────┘    │    └─────────────┘    │    └─────────────┘
                   │                       │
                   │    ┌─────────────┐    │
                   └───<│   Hints     │>───┘
                        └─────────────┘
```

### 2.2 Table Structure Design

#### 2.2.1 users - User Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  
  -- User Ability Profile
  current_level INTEGER DEFAULT 1 CHECK (current_level BETWEEN 1 AND 10),
  learning_goal VARCHAR(50), -- 'interview' | 'interest' | 'competition'
  
  -- Warm-up Conversation Results
  warmup_completed BOOLEAN DEFAULT FALSE,
  warmup_data JSONB, -- Store conversation history and assessment results
  
  -- Algorithm Proficiency Distribution (JSONB)
  algorithm_proficiency JSONB DEFAULT '{}',
  -- Example: {"Array": 6, "Linked List": 4, "Tree": 3}
  
  -- Learning Statistics
  total_problems_solved INTEGER DEFAULT 0,
  total_submissions INTEGER DEFAULT 0,
  average_score DECIMAL(5,2) DEFAULT 0,
  learning_velocity DECIMAL(3,2) DEFAULT 1.0,
  
  -- Recent Performance (for adaptation)
  recent_scores INTEGER[] DEFAULT '{}',
  -- Example: [85, 90, 78, 92, 88]
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
```

#### 2.2.2 problems - Problem Table
```sql
CREATE TABLE problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Information
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 10),
  
  -- Algorithm Classification
  algorithm_types TEXT[], -- ['Array', 'Hash Table', 'Two Pointers']
  
  -- Execution Limits
  time_limit INTEGER DEFAULT 2000, -- milliseconds
  memory_limit INTEGER DEFAULT 256, -- MB
  expected_complexity VARCHAR(50), -- 'O(n)', 'O(n log n)'
  
  -- Examples
  examples JSONB, -- [{"input": "...", "output": "...", "explanation": "..."}]
  
  -- Test Cases
  test_cases JSONB, -- [{"input": "...", "output": "...", "type": "basic"}]
  
  -- Standard Solutions (Multi-language)
  standard_solutions JSONB,
  -- {"python": "def solve()...", "javascript": "function solve()..."}
  
  -- Generation information
  generated_by VARCHAR(50), -- 'gpt-4', 'claude-3', 'manual'
  generation_prompt TEXT, -- Prompt used to generate this problem
  
  -- Statistics
  total_attempts INTEGER DEFAULT 0,
  total_solved INTEGER DEFAULT 0,
  average_score DECIMAL(5,2) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_problems_difficulty ON problems(difficulty);
CREATE INDEX idx_problems_algorithm_types ON problems USING GIN(algorithm_types);
```

#### 2.2.3 submissions - Submission Records Table
```sql
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  
  -- Submission Content
  code TEXT NOT NULL,
  language VARCHAR(20) NOT NULL, -- 'python', 'javascript', 'java'
  
  -- Execution Results
  status VARCHAR(20) NOT NULL, 
  -- 'accepted' | 'wrong_answer' | 'time_limit' | 'runtime_error'
  
  test_results JSONB,
  -- [{"case_id": 1, "passed": true, "time": 45, "memory": 12.5}]
  
  passed_cases INTEGER DEFAULT 0,
  total_cases INTEGER DEFAULT 0,
  
  execution_time INTEGER, -- milliseconds
  memory_used DECIMAL(10,2), -- MB
  
  -- Scoring
  score DECIMAL(5,2), -- Final Score
  correctness_score DECIMAL(5,2),
  time_score DECIMAL(5,2),
  hint_penalty DECIMAL(5,2),
  quality_score DECIMAL(5,2),
  
  -- Hint Usage
  hints_used INTEGER[] DEFAULT '{}', -- [1, 2] means used Level 1 and 2
  
  -- Code Quality Analysis
  complexity_analysis JSONB,
  -- {"time": "O(n^2)", "space": "O(1)", "meets_expectation": false}
  
  submitted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_submissions_user_id ON submissions(user_id);
CREATE INDEX idx_submissions_problem_id ON submissions(problem_id);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_submitted_at ON submissions(submitted_at DESC);
```

#### 2.2.4 hints - Hint Records Table
```sql
CREATE TABLE hints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  
  -- Hint Information
  hint_level INTEGER CHECK (hint_level BETWEEN 1 AND 4),
  hint_content TEXT NOT NULL,
  
  -- User's Current Code (When Generating Hint)
  user_code_snapshot TEXT,
  
  -- Generation information
  generated_by VARCHAR(50), -- 'gpt-4', 'claude-3'
  generation_time INTEGER, -- Generation time (milliseconds)
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_hints_user_problem ON hints(user_id, problem_id);
CREATE INDEX idx_hints_submission ON hints(submission_id);
```

#### 2.2.5 llm_configs - LLM Configuration Table
```sql
CREATE TABLE llm_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- LLM Configuration
  provider VARCHAR(50) DEFAULT 'openai', -- 'openai' | 'anthropic' | 'custom'
  api_key_encrypted TEXT, -- Encrypted storage
  model VARCHAR(50), -- 'gpt-4', 'claude-3-opus'
  
  -- API Configuration
  base_url TEXT, -- Custom API endpoint
  custom_headers JSONB, -- Custom request headers
  
  -- Usage Statistics
  total_requests INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_llm_configs_user_id ON llm_configs(user_id);
```

#### 2.2.6 warmup_conversations - Warm-up Conversation Table
```sql
CREATE TABLE warmup_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Conversation Content
  messages JSONB,
  -- [{"role": "assistant", "content": "..."}, {"role": "user", "content": "..."}]
  
  -- Assessment Results
  assessment JSONB,
  -- {
  --   "starting_level": 3,
  --   "weak_areas": ["Tree", "Graph"],
  --   "learning_goal": "interview",
  --   "confidence": 0.85
  -- }
  
  completed BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_warmup_user_id ON warmup_conversations(user_id);
```

### 2.3 Redis Cache Design

#### Cache Key Naming Convention
```
# User Sessions
session:{user_id} -> { token, expires_at, ... }

# Problem Cache (avoid frequent database queries)
problem:{problem_id} -> { complete problem JSON }
problem:list:{difficulty}:{algorithm_type} -> [ problem_ids ]

# LLM Response Cache (reuse same prompt)
llm:cache:{prompt_hash} -> { response, cached_at }

# User Statistics Cache
user:stats:{user_id} -> { total_solved, average_score, ... }

# Rate Limiting
ratelimit:{user_id}:{action} -> { count, expire }
```

---

## 3. API Design

### 3.1 RESTful API Specification

**Base URL**: `https://api.codetutor.com/v1`

**Authentication Method**: Bearer Token (JWT)

**Request Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

### 3.2 API Endpoint List

#### 3.2.1 Authentication Module

```http
POST   /auth/register          # User Registration
POST   /auth/login             # User Login
POST   /auth/logout            # User Logout
POST   /auth/refresh           # Refresh Token
POST   /auth/reset-password    # Reset Password
```

**Example: Registration**
```http
POST /auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}

Response 201:
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "john_doe",
      "email": "john@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### 3.2.2 Warm-up Module

```http
POST   /warmup/start           # Start warm-up conversation
POST   /warmup/message         # Send conversation message
POST   /warmup/complete        # Complete warm-up
GET    /warmup/status          # Get warm-up status
```

**Example: Send Message**
```http
POST /warmup/message
Authorization: Bearer <token>

{
  "message": "I understand arrays and linked lists, but I'm not very familiar with trees"
}

Response 200:
{
  "success": true,
  "data": {
    "reply": "Great! Have you solved algorithm problems before? How many have you done approximately?",
    "is_complete": false,
    "conversation_id": "uuid"
  }
}
```

#### 3.2.3 Problem Module

```http
GET    /problems/next          # Get next recommended problem
GET    /problems/:id           # Get problem details
POST   /problems/generate      # Generate new problem (admin)
GET    /problems               # Get problem list (filter/pagination)
```

**Example: Get next problem**
```http
GET /problems/next
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Two Sum",
    "description": "Given an integer array...",
    "difficulty": 3,
    "algorithm_types": ["Array", "Hash Table"],
    "time_limit": 2000,
    "memory_limit": 256,
    "expected_complexity": "O(n)",
    "examples": [...]
  }
}
```

#### 3.2.4 Submission Module

```http
POST   /submissions            # Submit code
GET    /submissions/:id        # Get submission details
GET    /submissions            # Get submission history
```

**Example: Submit code**
```http
POST /submissions
Authorization: Bearer <token>

{
  "problem_id": "uuid",
  "code": "def twoSum(nums, target):\n    ...",
  "language": "python"
}

Response 200:
{
  "success": true,
  "data": {
    "submission_id": "uuid",
    "status": "accepted",
    "passed_cases": 15,
    "total_cases": 15,
    "execution_time": 45,
    "memory_used": 12.5,
    "score": 95.5,
    "test_results": [...]
  }
}
```

#### 3.2.5 Hint Module

```http
POST   /hints                  # Request hint
GET    /hints/:problem_id      # Get hint history for a problem
```

**Example: Request hint**
```http
POST /hints
Authorization: Bearer <token>

{
  "problem_id": "uuid",
  "hint_level": 2,
  "current_code": "def twoSum(nums, target):\n    # Don't know how to write"
}

Response 200:
{
  "success": true,
  "data": {
    "hint_id": "uuid",
    "hint_level": 2,
    "content": "Algorithm framework:\n1. Use hash table to store...",
    "penalty": 0.15
  }
}
```

#### 3.2.6 User Module

```http
GET    /users/me               # Get current user information
PUT    /users/me               # Update user information
GET    /users/me/stats         # Get learning statistics
GET    /users/me/history       # Get learning history
```

#### 3.2.7 LLM Configuration Module

```http
GET    /llm/config             # Get LLM configuration
PUT    /llm/config             # Update LLM configuration
POST   /llm/test               # Test LLM connection
```

### 3.3 WebSocket API

**Connection Endpoint**: `wss://api.codetutor.com/ws`

**Purpose**: Real-time LLM streaming response

```javascript
// Client example
const ws = new WebSocket('wss://api.codetutor.com/ws');

ws.send(JSON.stringify({
  type: 'warmup_message',
  data: { message: 'I am a beginner' }
}));

ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  if (type === 'llm_chunk') {
    // Stream receive LLM response
    console.log(data.chunk);
  }
};
```

---

## 4. LLM Integration Solution

### 4.1 Unified Interface Design

```typescript
// src/services/llm/interface.ts
interface LLMProvider {
  generateCompletion(prompt: string, options?: CompletionOptions): Promise<string>;
  streamCompletion(prompt: string, options?: CompletionOptions): AsyncGenerator<string>;
  estimateTokens(text: string): number;
}

interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}
```

### 4.2 Provider Implementation

```typescript
// OpenAI Provider
class OpenAIProvider implements LLMProvider {
  async generateCompletion(prompt: string, options?: CompletionOptions) {
    const response = await openai.chat.completions.create({
      model: options?.model || 'gpt-4',
      messages: [
        { role: 'system', content: options?.systemPrompt || '' },
        { role: 'user', content: prompt }
      ],
      temperature: options?.temperature || 0.7,
      max_tokens: options?.maxTokens || 2000
    });
    return response.choices[0].message.content;
  }
}

// Anthropic Provider
class AnthropicProvider implements LLMProvider {
  async generateCompletion(prompt: string, options?: CompletionOptions) {
    const response = await anthropic.messages.create({
      model: options?.model || 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: prompt }],
      system: options?.systemPrompt || '',
      max_tokens: options?.maxTokens || 2000
    });
    return response.content[0].text;
  }
}
```

### 4.3 Prompt Templates

#### Warm-up Conversation
```typescript
const WARMUP_SYSTEM_PROMPT = `
You are an algorithm learning assistant, having a conversation with a new user to understand their algorithm foundation.

Your task:
1. Through 3-5 rounds of conversation, understand the user's:
   - Data structure mastery level (arrays, linked lists, trees, graphs, etc.)
   - Algorithm experience (how many problems solved, familiar algorithm types)
   - Learning goals (interview preparation/interest learning/competition training)

2. Conversation requirements:
   - Friendly and encouraging tone
   - Concise and clear questions
   - Avoid overly technical terms

3. Final output (after 3-5 rounds):
   Assessment results in JSON format:
   {
     "starting_level": 1-10,
     "weak_areas": ["tree", "graph"],
     "learning_goal": "interview",
     "confidence": 0.85
   }
`;
```

#### Problem Generation
```typescript
const PROBLEM_GENERATION_PROMPT = (difficulty: number, algorithmType: string) => `
Generate an algorithm problem with requirements:

Difficulty level: ${difficulty}/10
Algorithm type: ${algorithmType}

Must include the complete JSON structure:
{
  "title": "Problem title",
  "description": "Detailed description, including input and output formats",
  "difficulty": ${difficulty},
  "algorithm_types": ["${algorithmType}"],
  "time_limit": 2000,
  "memory_limit": 256,
  "expected_complexity": "O(n)",
  "examples": [
    {
      "input": "Specific input",
      "output": "Expected output",
      "explanation": "Explanation"
    }
  ],
  "test_cases": [
    {"input": "...", "output": "...", "type": "basic"},
    {"input": "...", "output": "...", "type": "edge"},
    {"input": "...", "output": "...", "type": "performance"}
  ],
  "standard_solutions": {
    "python": "Complete Python code",
    "javascript": "Complete JavaScript code"
  }
}

Requirements:
- At least 3 basic test cases
- At least 2 edge test cases
- At least 1 performance test case
- Standard solutions must pass all test cases
`;
```

#### Hint Generation
```typescript
const HINT_GENERATION_PROMPT = (
  problem: Problem,
  userCode: string,
  level: number
) => `
User is solving the following algorithm problem:

Problem: ${problem.title}
Description: ${problem.description}

User's current code:
\`\`\`
${userCode || 'User has not started writing code yet'}
\`\`\`

Please generate Level ${level} hint:

Level 1 (Idea Hint): Algorithm direction, data structure suggestions, complexity goals
Level 2 (Framework Hint): Algorithm steps, key logic
Level 3 (Pseudocode): Detailed pseudocode steps
Level 4 (Code Snippet): Implementation code for key parts

Requirements:
- Do not give the complete answer directly
- Hints should be progressive
- Encourage independent thinking
`;
```

---

## 5. Code Executor Integration

### 5.1 Judge0 Architecture

```
┌─────────────┐
│   Backend   │
│   (Node.js) │
└──────┬──────┘
       │ HTTP/gRPC
       │
┌──────▼──────┐
│   Judge0    │
│   API       │
└──────┬──────┘
       │
┌──────▼──────┐    ┌──────────┐    ┌──────────┐
│  Queue      │───>│ Worker 1 │───>│ Docker   │
│  (Redis)    │    └──────────┘    │ Sandbox  │
└─────────────┘    ┌──────────┐    └──────────┘
                   │ Worker 2 │───>│ Docker   │
                   └──────────┘    │ Sandbox  │
```

### 5.2 API Call Example

```typescript
// src/services/codeExecutor.ts
import axios from 'axios';

interface ExecutionRequest {
  sourceCode: string;
  languageId: number;
  stdin?: string;
  expectedOutput?: string;
  cpuTimeLimit?: number;
  memoryLimit?: number;
}

class CodeExecutor {
  private judge0Url = process.env.JUDGE0_URL || 'http://localhost:2358';

  async execute(request: ExecutionRequest) {
    // 1. Submit code
    const submission = await axios.post(`${this.judge0Url}/submissions`, {
      source_code: Buffer.from(request.sourceCode).toString('base64'),
      language_id: request.languageId,
      stdin: request.stdin ? Buffer.from(request.stdin).toString('base64') : undefined,
      expected_output: request.expectedOutput,
      cpu_time_limit: request.cpuTimeLimit || 2.0,
      memory_limit: (request.memoryLimit || 256) * 1024 // KB
    });

    const token = submission.data.token;

    // 2. Poll results
    let result;
    let attempts = 0;
    while (attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const statusResponse = await axios.get(
        `${this.judge0Url}/submissions/${token}`
      );
      
      result = statusResponse.data;
      
      if (result.status.id > 2) { // Completed
        break;
      }
      attempts++;
    }

    return {
      status: this.mapStatus(result.status.id),
      stdout: result.stdout ? Buffer.from(result.stdout, 'base64').toString() : '',
      stderr: result.stderr ? Buffer.from(result.stderr, 'base64').toString() : '',
      time: result.time,
      memory: result.memory / 1024, // Convert to MB
      compile_output: result.compile_output
    };
  }

  private mapStatus(statusId: number): string {
    const statusMap: Record<number, string> = {
      3: 'accepted',
      4: 'wrong_answer',
      5: 'time_limit_exceeded',
      6: 'compilation_error',
      7: 'runtime_error',
      // ... more statuses
    };
    return statusMap[statusId] || 'unknown';
  }
}
```

### 5.3 Language ID Mapping

```typescript
const LANGUAGE_MAP = {
  'python': 71,      // Python 3.8.1
  'javascript': 63,  // Node.js 12.14.0
  'java': 62,        // Java 13.0.1
  'cpp': 54,         // C++ 17
  'go': 60,          // Go 1.13.5
};
```

---

## 6. Security Design

### 6.1 Authentication and Authorization

#### JWT Token Structure
```json
{
  "sub": "user_id",
  "username": "john_doe",
  "iat": 1699000000,
  "exp": 1699086400
}
```

#### Password Storage
```typescript
import bcrypt from 'bcrypt';

// During registration
const saltRounds = 12;
const passwordHash = await bcrypt.hash(password, saltRounds);

// During login
const isValid = await bcrypt.compare(password, user.password_hash);
```

### 6.2 API Key Encryption

```typescript
import crypto from 'crypto';

class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

### 6.3 Code Execution Security

- Docker container isolation
- Disable network access
- Restrict file system access
- CPU and memory limits
- Execution timeout control

---

## 7. Performance Optimization

### 7.1 Database Optimization
- Establish appropriate indexes
- Use connection pooling
- Query result caching (Redis)
- Read-write separation (optional)

### 7.2 API Optimization
- Response compression (gzip)
- Pagination queries
- Field selection (return only necessary fields)
- Batch operation interfaces

### 7.3 Caching Strategy
```typescript
// Multi-level caching
const getCachedProblem = async (problemId: string) => {
  // 1. Memory cache (LRU)
  if (memoryCache.has(problemId)) {
    return memoryCache.get(problemId);
  }

  // 2. Redis cache
  const cached = await redis.get(`problem:${problemId}`);
  if (cached) {
    const problem = JSON.parse(cached);
    memoryCache.set(problemId, problem);
    return problem;
  }

  // 3. Database query
  const problem = await prisma.problem.findUnique({
    where: { id: problemId }
  });

  // Write back to cache
  await redis.setex(`problem:${problemId}`, 3600, JSON.stringify(problem));
  memoryCache.set(problemId, problem);

  return problem;
};
```

---

## 8. Monitoring and Logging

### 8.1 Log Levels
- **ERROR**: System errors that require immediate handling
- **WARN**: Warning information that may need attention
- **INFO**: General information, business process records
- **DEBUG**: Debug information, used in development environment

### 8.2 Key Metrics
- API Response Time
- Database Query Time
- LLM Call Latency
- Code Execution Time
- Error Rate
- Concurrent Users

---

**Document Status**: ✅ Completed  
**Reviewer**: Pending  
**Last Updated**: 2024-11-04
