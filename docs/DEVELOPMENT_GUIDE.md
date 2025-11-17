# Development Guide
# LLM-Driven Adaptive Algorithm Learning Platform

**Version**: 1.0
**Creation Date**: 2024-11-04

---

## 1. Project Overview

This project is an intelligent algorithm learning platform driven by large language models, main features:
- Dynamic algorithm problem generation
- Adaptive difficulty adjustment
- Intelligent graded hint system
- Multi-language code execution
- Personalized learning paths

---

## 2. Pre-Development Preparation

### 2.1 Read Documentation

**Required Reading** (in order):
1. ✅ **PRD.md** - Product requirements document, understand functional requirements
2. ✅ **TECH_DESIGN.md** - Technical design document, understand system architecture
3. ✅ **FRONTEND_DESIGN.md** - Frontend design document, understand page structure
4. ✅ **CODE_EXECUTOR_DEPLOYMENT.md** - Code executor deployment
5. ✅ **DATABASE_DEPLOYMENT.md** - Database deployment
6. ✅ **DEVELOPMENT_GUIDE.md** (This document) - Development guide

### 2.2 Deploy Infrastructure

**Deploy in the following order**:

1. **Deploy Database** (highest priority)
   ```bash
   cd ~/codetutor/database
   # Refer to DATABASE_DEPLOYMENT.md
   docker compose up -d
   ```

2. **Deploy Code Executor**
   ```bash
   cd ~/judge0
   # Refer to CODE_EXECUTOR_DEPLOYMENT.md
   docker compose up -d
   ```

3. **Verify Infrastructure**
   ```bash
   # Test PostgreSQL
   psql -h localhost -U codetutor -d codetutor -c "SELECT 'DB OK';"
   
   # Test Redis
   docker exec codetutor-redis redis-cli -a password PING
   
   # Test Judge0
   curl http://localhost:2358/about
   ```

---

## 3. Project Structure

### 3.1 Complete Directory Tree

```
codetutor/
├── docs/                                # Documentation Directory
│   ├── PRD.md
│   ├── TECH_DESIGN.md
│   ├── FRONTEND_DESIGN.md
│   ├── CODE_EXECUTOR_DEPLOYMENT.md
│   ├── DATABASE_DEPLOYMENT.md
│   └── DEVELOPMENT_GUIDE.md
│
├── frontend/                            # Frontend Project
│   ├── src/
│   │   ├── app/                         # Next.js App Router
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── auth/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── register/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── warmup/page.tsx
│   │   │   ├── problem/[id]/page.tsx
│   │   │   ├── history/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   └── settings/page.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                      # Shadcn/ui Basic Components
│   │   │   │   ├── button.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   └── ...
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Footer.tsx
│   │   │   ├── problem/
│   │   │   │   ├── ProblemDescription.tsx
│   │   │   │   ├── CodeEditor.tsx
│   │   │   │   ├── TestResults.tsx
│   │   │   │   └── HintModal.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── StatsOverview.tsx
│   │   │   │   ├── ProgressChart.tsx
│   │   │   │   └── SkillRadar.tsx
│   │   │   └── warmup/
│   │   │       ├── ChatMessage.tsx
│   │   │       └── ChatInput.tsx
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts                   # API Call Wrapper
│   │   │   ├── auth.ts                  # Authentication Related
│   │   │   └── utils.ts                 # Utility Functions
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useSubmission.ts
│   │   │   └── useHint.ts
│   │   │
│   │   ├── stores/
│   │   │   ├── authStore.ts             # Zustand State Management
│   │   │   └── editorStore.ts
│   │   │
│   │   └── types/
│   │       ├── user.ts
│   │       ├── problem.ts
│   │       └── submission.ts
│   │
│   ├── public/                          # Static Resources
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── next.config.js
│
├── backend/                             # 后端项目
│   ├── src/
│   │   ├── index.ts                     # 入口文件
│   │   │
│   │   ├── config/
│   │   │   └── index.ts                 # 配置管理
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.ts                  # 认证路由
│   │   │   ├── warmup.ts                # Warm-up 路由
│   │   │   ├── problems.ts              # 题目路由
│   │   │   ├── submissions.ts           # 提交路由
│   │   │   ├── hints.ts                 # 提示路由
│   │   │   ├── users.ts                 # 用户路由
│   │   │   └── llm.ts                   # LLM 配置路由
│   │   │
│   │   ├── controllers/
│   │   │   ├── authController.ts
│   │   │   ├── warmupController.ts
│   │   │   ├── problemController.ts
│   │   │   ├── submissionController.ts
│   │   │   ├── hintController.ts
│   │   │   └── userController.ts
│   │   │
│   │   ├── services/
│   │   │   ├── authService.ts
│   │   │   ├── llm/
│   │   │   │   ├── LLMProvider.ts       # LLM 接口定义
│   │   │   │   ├── OpenAIProvider.ts
│   │   │   │   ├── AnthropicProvider.ts
│   │   │   │   └── LLMFactory.ts
│   │   │   ├── codeExecutor.ts          # Judge0 集成
│   │   │   ├── problemGenerator.ts      # 题目生成
│   │   │   ├── hintGenerator.ts         # 提示生成
│   │   │   ├── evaluationService.ts     # 评分系统
│   │   │   └── adaptiveService.ts       # 自适应难度
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.ts                  # JWT 验证
│   │   │   ├── errorHandler.ts          # 错误处理
│   │   │   └── rateLimit.ts             # 限流
│   │   │
│   │   ├── lib/
│   │   │   ├── prisma.ts                # Prisma 客户端
│   │   │   ├── redis.ts                 # Redis 客户端
│   │   │   └── encryption.ts            # 加密工具
│   │   │
│   │   ├── types/
│   │   │   ├── user.ts
│   │   │   ├── problem.ts
│   │   │   └── submission.ts
│   │   │
│   │   └── utils/
│   │       ├── logger.ts                # 日志工具
│   │       └── validator.ts             # 验证工具
│   │
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
└── README.md                            # 项目总览
```

---

## 4. 开发环境设置

### 4.1 安装依赖

**系统依赖**:
- Node.js 20 LTS
- pnpm 8
- Git
- Docker & Docker Compose

**安装 Node.js (使用 nvm)**:
```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 安装 Node.js 20
nvm install 20
nvm use 20

# 验证
node --version  # v20.x.x
```

**安装 pnpm**:
```bash
npm install -g pnpm

# 验证
pnpm --version  # 8.x.x
```

### 4.2 克隆并初始化项目

```bash
# 克隆仓库 (假设已创建)
git clone https://github.com/yourusername/codetutor.git
cd codetutor

# 或创建新项目
mkdir codetutor
cd codetutor
git init
```

### 4.3 初始化前端

```bash
# 创建 Next.js 项目
pnpx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir

cd frontend

# 安装 Shadcn/ui
pnpx shadcn-ui@latest init

# 安装依赖
pnpm add zustand axios zod react-hook-form @hookform/resolvers/zod
pnpm add @monaco-editor/react recharts lucide-react
pnpm add @radix-ui/react-dialog @radix-ui/react-select

# 开发依赖
pnpm add -D @types/node typescript
```

### 4.4 初始化后端

```bash
cd ../
mkdir backend
cd backend

# 初始化项目
pnpm init

# 安装依赖
pnpm add express cors dotenv
pnpm add @prisma/client bcrypt jsonwebtoken
pnpm add axios openai @anthropic-ai/sdk
pnpm add winston redis ioredis

# 开发依赖
pnpm add -D typescript @types/node @types/express
pnpm add -D @types/cors @types/bcrypt @types/jsonwebtoken
pnpm add -D ts-node nodemon prisma

# 初始化 TypeScript
pnpx tsc --init

# 初始化 Prisma
pnpx prisma init
```

### 4.5 配置环境变量

**前端 `.env.local`**:
```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

**后端 `.env`**:
```bash
# backend/.env

# 服务器
NODE_ENV=development
PORT=3001

# 数据库 (连接到远程服务器 192.168.100.207)
DATABASE_URL=postgresql://codetutor:your-password@192.168.100.207:5432/codetutor
REDIS_URL=redis://:your-password@192.168.100.207:6379

# JWT
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRES_IN=7d

# 加密
ENCRYPTION_KEY=your-32-byte-hex-key-here

# Judge0 (连接到远程服务器 192.168.100.207)
JUDGE0_URL=http://192.168.100.207:2358
JUDGE0_AUTH_TOKEN=your-judge0-token

# LLM (默认配置,用户可在界面中配置)
DEFAULT_LLM_PROVIDER=openai
DEFAULT_OPENAI_API_KEY=sk-...
DEFAULT_ANTHROPIC_API_KEY=sk-ant-...

# 其他
LOG_LEVEL=info
```

**重要说明**:
- 数据库和 Redis 使用远程服务器地址 `192.168.100.207`
- Judge0 也部署在远程服务器上
- 密码需要与服务器上的配置保持一致 (参考部署文档中设置的密码)

---

## 5. 开发阶段划分

### 阶段 0: 基础设施 ✅
- [x] 在远程服务器 (192.168.100.207) 部署 PostgreSQL + Redis
- [x] 在远程服务器部署 Judge0 代码执行器
- [x] 验证从本地开发机到远程服务器的连接
- [x] 测试数据库远程连接
- [x] 测试 Judge0 远程调用

**验证步骤**:
```powershell
# 在本地 Windows 上测试
ping 192.168.100.207

# 测试数据库端口
Test-NetConnection -ComputerName 192.168.100.207 -Port 5432
Test-NetConnection -ComputerName 192.168.100.207 -Port 6379
Test-NetConnection -ComputerName 192.168.100.207 -Port 2358

# 测试 Judge0 API
curl http://192.168.100.207:2358/about
```

### 阶段 1: MVP (最小可行产品) - P0 功能

**目标**: 实现核心功能,能够完整演示产品流程

#### 1.1 后端基础 (1-2 天)
- [ ] 搭建 Express 服务器
- [ ] 配置 Prisma ORM
- [ ] 实现用户注册/登录 API
- [ ] 实现 JWT 认证中间件

#### 1.2 前端基础 (1-2 天)
- [ ] 设置 Next.js 项目结构
- [ ] 配置 Shadcn/ui
- [ ] 实现登录/注册页面
- [ ] 实现全局状态管理 (Zustand)

#### 1.3 Warm-up 对话系统 (2-3 天)
- [ ] 后端: LLM Provider 抽象层
- [ ] 后端: Warm-up 对话 API
- [ ] 前端: 聊天界面组件
- [ ] 集成: 完整对话流程测试

#### 1.4 题目生成系统 (2-3 天)
- [ ] 后端: 题目生成 Prompt 设计
- [ ] 后端: 题目生成 API
- [ ] 后端: 题目存储逻辑
- [ ] 测试: 生成多个难度的题目

#### 1.5 代码提交与执行 (3-4 天)
- [ ] 后端: Judge0 集成封装
- [ ] 后端: 提交 API
- [ ] 前端: Monaco Editor 集成
- [ ] 前端: 题目页面实现
- [ ] 前端: 测试结果展示
- [ ] 测试: 多语言代码执行

#### 1.6 评分系统 (2 天)
- [ ] 后端: 评分算法实现
- [ ] 后端: 评分 API
- [ ] 前端: 得分展示

#### 1.7 自适应难度 (2 天)
- [ ] 后端: 难度调整逻辑
- [ ] 后端: 用户能力画像更新
- [ ] 测试: 模拟用户做题,验证难度变化

#### 1.8 Dashboard (2 天)
- [ ] 后端: 用户统计 API
- [ ] 前端: Dashboard 页面
- [ ] 前端: 统计图表

**MVP 总计**: 约 15-20 天

---

### 阶段 2: 完善功能 - P1 功能

#### 2.1 智能提示系统 (3-4 天)
- [ ] 后端: 提示生成 Prompt
- [ ] 后端: 分级提示 API
- [ ] 前端: 提示弹窗组件
- [ ] 集成: 提示扣分逻辑

#### 2.2 历史记录 (2 天)
- [ ] 后端: 历史记录查询 API
- [ ] 前端: 历史记录页面
- [ ] 前端: 筛选和搜索

#### 2.3 用户能力画像 (2-3 天)
- [ ] 后端: 能力分析算法
- [ ] 前端: 能力雷达图
- [ ] 前端: 学习进度可视化

**阶段 2 总计**: 约 7-10 天

---

### 阶段 3: 优化和扩展 - P2 功能

- [ ] 题目收藏功能
- [ ] 代码分享功能
- [ ] 社区讨论
- [ ] 学习路径推荐
- [ ] 移动端适配

**阶段 3 总计**: 根据需求确定

---

## 6. 开发流程

### 6.1 Git 工作流

**分支策略**:
```
main            # 生产环境
├── develop     # 开发主分支
    ├── feature/user-auth      # 功能分支
    ├── feature/warmup-chat
    ├── feature/code-executor
    └── feature/hint-system
```

**开发流程**:
```bash
# 1. 从 develop 创建功能分支
git checkout develop
git pull
git checkout -b feature/your-feature

# 2. 开发并提交
git add .
git commit -m "feat: implement user authentication"

# 3. 推送到远程
git push origin feature/your-feature

# 4. 创建 Pull Request
# 在 GitHub 上创建 PR: feature/your-feature -> develop

# 5. 合并后删除分支
git checkout develop
git pull
git branch -d feature/your-feature
```

**Commit 规范** (Conventional Commits):
```
feat:     新功能
fix:      修复 bug
docs:     文档更新
style:    代码格式(不影响功能)
refactor: 重构
test:     测试相关
chore:    构建/工具配置
```

### 6.2 本地开发

**启动前端**:
```bash
cd frontend
pnpm dev
# http://localhost:3000
```

**启动后端**:
```bash
cd backend
pnpm dev
# http://localhost:3001
```

**数据库迁移**:
```bash
cd backend

# 创建迁移
pnpx prisma migrate dev --name init

# 生成 Prisma Client
pnpx prisma generate

# 可视化数据库
pnpx prisma studio
# http://localhost:5555
```

### 6.3 代码规范

**ESLint + Prettier**:

**前端 `.eslintrc.json`**:
```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

**Prettier 配置 `.prettierrc`**:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

**安装工具**:
```bash
# 前端
cd frontend
pnpm add -D eslint prettier eslint-config-prettier

# 后端
cd backend
pnpm add -D eslint prettier @typescript-eslint/eslint-plugin
```

---

## 7. 测试策略

### 7.1 单元测试

**使用 Jest + Testing Library**:

```bash
# 安装依赖
pnpm add -D jest @testing-library/react @testing-library/jest-dom
pnpm add -D @types/jest ts-jest
```

**示例测试**:
```typescript
// __tests__/components/CodeEditor.test.tsx
import { render, screen } from '@testing-library/react';
import CodeEditor from '@/components/problem/CodeEditor';

describe('CodeEditor', () => {
  it('renders code editor', () => {
    render(<CodeEditor language="python" value="" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});
```

### 7.2 集成测试

**后端 API 测试**:
```typescript
// __tests__/api/auth.test.ts
import request from 'supertest';
import app from '@/index';

describe('POST /api/auth/register', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });
    
    expect(res.status).toBe(201);
    expect(res.body.data.user.username).toBe('testuser');
  });
});
```

### 7.3 E2E 测试 (可选)

使用 Playwright:
```bash
pnpm add -D @playwright/test
pnpx playwright install
```

---

## 8. 部署准备

### 8.1 构建生产版本

**前端**:
```bash
cd frontend
pnpm build
pnpm start  # 生产模式运行
```

**后端**:
```bash
cd backend
pnpm build  # 编译 TypeScript

# package.json scripts
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

### 8.2 Docker 化 (可选)

**前端 Dockerfile**:
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./

RUN npm install -g pnpm && pnpm install --prod

EXPOSE 3000
CMD ["pnpm", "start"]
```

---

## 9. 常用命令速查

### 9.1 开发
```bash
# 启动前端
cd frontend && pnpm dev

# 启动后端
cd backend && pnpm dev

# 数据库可视化
cd backend && pnpx prisma studio

# 代码格式化
pnpm format

# 代码检查
pnpm lint
```

### 9.2 数据库
```bash
# 创建迁移
pnpx prisma migrate dev --name your_migration_name

# 重置数据库 (危险!)
pnpx prisma migrate reset

# 生成 Prisma Client
pnpx prisma generate

# 同步 schema (无迁移)
pnpx prisma db push
```

### 9.3 Docker
```bash
# 启动数据库
docker compose -f database/docker-compose.yml up -d

# 启动 Judge0
docker compose -f judge0/docker-compose.yml up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

---

## 10. 开发检查清单

### 开始开发前
- [ ] 阅读完所有文档
- [ ] 部署并测试数据库
- [ ] 部署并测试 Judge0
- [ ] 配置开发环境
- [ ] 创建功能分支

### 功能开发中
- [ ] 遵循代码规范
- [ ] 编写单元测试
- [ ] 提交有意义的 commit
- [ ] 定期推送到远程

### 功能完成后
- [ ] 测试所有功能点
- [ ] 更新相关文档
- [ ] 创建 Pull Request
- [ ] Code Review
- [ ] 合并到 develop

---

## 11. 常见问题

### Q1: Prisma Client 报错
```bash
# 重新生成
pnpx prisma generate
```

### Q2: Judge0 连接失败
```bash
# 检查服务状态
curl http://localhost:2358/about

# 查看日志
docker compose -f judge0/docker-compose.yml logs
```

### Q3: 前端无法连接后端
- 检查 `.env.local` 中的 API URL
- 确认后端已启动
- 检查 CORS 配置

### Q4: TypeScript 类型错误
```bash
# 重新安装类型定义
pnpm add -D @types/node @types/react
```

---

## 12. 学习资源

- **Next.js**: https://nextjs.org/docs
- **Prisma**: https://www.prisma.io/docs
- **Shadcn/ui**: https://ui.shadcn.com/
- **Judge0**: https://github.com/judge0/judge0
- **OpenAI API**: https://platform.openai.com/docs
- **Anthropic API**: https://docs.anthropic.com/

---

## 13. 联系方式

- **项目负责人**: [Your Name]
- **技术问题**: [Email/Slack]
- **文档问题**: [GitHub Issues]

---

**开始开发吧!** 🚀

记住: 
1. 严格按照阶段划分开发
2. MVP 优先,不要过度设计
3. 遇到问题先查文档
4. 及时沟通和记录

**文档状态**: ✅ 完成  
**审核人**: 待定  
**最后更新**: 2024-11-04
