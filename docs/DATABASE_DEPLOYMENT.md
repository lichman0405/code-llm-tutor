# Database Deployment Document
# PostgreSQL + Redis

**Version**: 2.0
**Creation Date**: 2024-11-04
**Update Date**: 2024-11-04
**Database**: PostgreSQL 16 + Redis 7
**Deployment Location**: Remote Server `192.168.100.207`

---

## ⚠️ Important Notes

**Deployment Architecture**:
- 📍 **Database Server**: `192.168.100.207` (Linux Server)
- 💻 **Development Environment**: Local Windows Computer
- 🔗 **Connection Method**: Local development environment connects to remote database via network

**This document will help you complete deployment in 10 minutes, ready to use out of the box.**

---

## 1. Quick Deployment (10 Minutes)

### Step 1: Connect to Server

```bash
# Connect to server from local Windows
ssh username@192.168.100.207
```

### Step 2: Install Docker (if not installed)

```bash
# One-click installation script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Verify
docker --version
docker compose version
```

### Step 3: Create Deployment Directory

```bash
# Create directory
mkdir -p ~/codetutor/database
cd ~/codetutor/database
```

### Step 4: Create Configuration Files

**Create `docker-compose.yml`:**

```bash
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: codetutor-postgres
    environment:
      POSTGRES_USER: codetutor
      POSTGRES_PASSWORD: codetutor123
      POSTGRES_DB: codetutor
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: codetutor-redis
    command: redis-server --requirepass redis123 --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  postgres-data:
  redis-data:
EOF
```

**Create `init.sql`:**

```bash
cat > init.sql << 'EOF'
-- PostgreSQL Initialization Script
SET TIME ZONE 'UTC';

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create enum types
CREATE TYPE learning_goal AS ENUM ('interview', 'interest', 'competition');
CREATE TYPE submission_status AS ENUM ('accepted', 'wrong_answer', 'time_limit_exceeded', 'runtime_error', 'compilation_error');
CREATE TYPE llm_provider AS ENUM ('openai', 'anthropic', 'custom');

-- User table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  current_level INTEGER DEFAULT 1 CHECK (current_level BETWEEN 1 AND 10),
  learning_goal learning_goal,
  warmup_completed BOOLEAN DEFAULT FALSE,
  warmup_data JSONB DEFAULT '{}',
  algorithm_proficiency JSONB DEFAULT '{}',
  total_problems_solved INTEGER DEFAULT 0,
  total_submissions INTEGER DEFAULT 0,
  average_score DECIMAL(5,2) DEFAULT 0,
  learning_velocity DECIMAL(3,2) DEFAULT 1.0,
  recent_scores INTEGER[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

-- Problem table
CREATE TABLE problems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 10),
  algorithm_types TEXT[],
  time_limit INTEGER DEFAULT 2000,
  memory_limit INTEGER DEFAULT 256,
  expected_complexity VARCHAR(50),
  examples JSONB,
  test_cases JSONB,
  standard_solutions JSONB,
  generated_by VARCHAR(50),
  generation_prompt TEXT,
  total_attempts INTEGER DEFAULT 0,
  total_solved INTEGER DEFAULT 0,
  average_score DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Submission records table
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  language VARCHAR(20) NOT NULL,
  status submission_status NOT NULL,
  test_results JSONB,
  passed_cases INTEGER DEFAULT 0,
  total_cases INTEGER DEFAULT 0,
  execution_time INTEGER,
  memory_used DECIMAL(10,2),
  score DECIMAL(5,2),
  correctness_score DECIMAL(5,2),
  time_score DECIMAL(5,2),
  hint_penalty DECIMAL(5,2),
  quality_score DECIMAL(5,2),
  hints_used INTEGER[] DEFAULT '{}',
  complexity_analysis JSONB,
  submitted_at TIMESTAMP DEFAULT NOW()
);

-- Hint records table
CREATE TABLE hints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  hint_level INTEGER CHECK (hint_level BETWEEN 1 AND 4),
  hint_content TEXT NOT NULL,
  user_code_snapshot TEXT,
  generated_by VARCHAR(50),
  generation_time INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- LLM configuration table
CREATE TABLE llm_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  provider llm_provider DEFAULT 'openai',
  api_key_encrypted TEXT,
  model VARCHAR(50),
  base_url TEXT,
  custom_headers JSONB,
  total_requests INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Warm-up Conversation Table
CREATE TABLE warmup_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  messages JSONB,
  assessment JSONB,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_problems_difficulty ON problems(difficulty);
CREATE INDEX idx_submissions_user_id ON submissions(user_id);
CREATE INDEX idx_submissions_problem_id ON submissions(problem_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_problems_updated_at BEFORE UPDATE ON problems
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

SELECT 'Database initialized successfully!' AS message;
EOF
```

### Step 5: Start Services

```bash
# 启动所有服务
docker compose up -d

# 查看状态 (等待 30 秒后检查)
sleep 30
docker compose ps

# 查看日志
docker compose logs
```

### 步骤 6: 验证部署

**测试 PostgreSQL**:
```bash
docker exec -it codetutor-postgres psql -U codetutor -d codetutor -c "\dt"
```

**测试 Redis**:
```bash
docker exec -it codetutor-redis redis-cli -a redis123 PING
```

---

## 2. 从本地 Windows 连接

### 2.1 配置本地环境变量

在本地项目的 `backend/.env`:

```env
DATABASE_URL=postgresql://codetutor:codetutor123@192.168.100.207:5432/codetutor
REDIS_URL=redis://:redis123@192.168.100.207:6379
```

### 2.2 测试连接

**测试端口**:
```powershell
Test-NetConnection -ComputerName 192.168.100.207 -Port 5432
Test-NetConnection -ComputerName 192.168.100.207 -Port 6379
```

**测试 PostgreSQL** (需要安装 psql):
```powershell
psql -h 192.168.100.207 -U codetutor -d codetutor
```

**测试 Redis** (使用 Docker):
```powershell
docker run --rm -it redis:7-alpine redis-cli -h 192.168.100.207 -a redis123 PING
```

**使用 Prisma 测试**:
```powershell
cd backend
npx prisma db pull
npx prisma studio  # 打开 http://localhost:5555
```

---

## 3. 常用命令

### 3.1 服务管理

```bash
# 启动服务
docker compose up -d

# 停止服务
docker compose stop

# 重启服务
docker compose restart

# 查看状态
docker compose ps

# 查看日志
docker compose logs -f

# 停止并删除容器
docker compose down

# 停止并删除容器+数据卷 (危险!)
docker compose down -v
```

### 3.2 数据库操作

```bash
# 进入 PostgreSQL
docker exec -it codetutor-postgres psql -U codetutor -d codetutor

# 常用 SQL 命令
\dt              # 列出所有表
\d users         # 查看表结构
SELECT * FROM users LIMIT 10;
\q               # 退出

# 进入 Redis
docker exec -it codetutor-redis redis-cli -a redis123

# 常用 Redis 命令
PING
KEYS *
GET key
SET key value
INFO
EXIT
```

### 3.3 备份和恢复

**PostgreSQL 备份**:
```bash
# 备份
docker exec codetutor-postgres pg_dump -U codetutor codetutor > backup.sql

# 恢复
cat backup.sql | docker exec -i codetutor-postgres psql -U codetutor codetutor
```

**Redis 备份**:
```bash
# 触发保存
docker exec codetutor-redis redis-cli -a redis123 SAVE

# 复制备份文件
docker cp codetutor-redis:/data/dump.rdb ./redis_backup.rdb

# 恢复 (停止 Redis -> 复制文件 -> 重启)
docker compose stop redis
docker cp redis_backup.rdb codetutor-redis:/data/dump.rdb
docker compose start redis
```

---

## 4. 故障排查

### 问题 1: Redis 无法启动

**症状**: `docker compose ps` 显示 redis 一直 restarting

**解决**:
```bash
# 查看详细日志
docker compose logs redis

# 如果看到权限错误,修复数据卷权限
docker compose down
docker volume rm database_redis-data
docker compose up -d

# 如果是配置错误,使用本文档提供的简化配置
```

### 问题 2: 无法从本地连接

**检查网络**:
```bash
# 在服务器上检查端口监听
netstat -tlnp | grep 5432
netstat -tlnp | grep 6379

# 或使用 ss
ss -tlnp | grep 5432
```

**检查 Docker 容器**:
```bash
# 从服务器本地测试
docker exec codetutor-postgres psql -U codetutor -d codetutor -c "SELECT 1"
docker exec codetutor-redis redis-cli -a redis123 PING
```

### 问题 3: 数据持久化失败

**检查卷**:
```bash
# 列出所有卷
docker volume ls

# 查看卷详情
docker volume inspect database_postgres-data
docker volume inspect database_redis-data
```

---

## 5. 性能优化 (可选)

### 5.1 PostgreSQL 优化

修改 `docker-compose.yml`:
```yaml
postgres:
  environment:
    POSTGRES_SHARED_BUFFERS: 512MB      # 服务器内存的 25%
    POSTGRES_EFFECTIVE_CACHE_SIZE: 2GB  # 服务器内存的 50%
    POSTGRES_WORK_MEM: 32MB
    POSTGRES_MAINTENANCE_WORK_MEM: 256MB
```

### 5.2 Redis 优化

```yaml
redis:
  command: redis-server --requirepass redis123 --appendonly yes --maxmemory 1gb --maxmemory-policy allkeys-lru
```

---

## 附录: 完整配置文件

### docker-compose.yml (推荐)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: codetutor-postgres
    environment:
      POSTGRES_USER: codetutor
      POSTGRES_PASSWORD: codetutor123  # 生产环境请修改!
      POSTGRES_DB: codetutor
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: codetutor-redis
    command: redis-server --requirepass redis123 --appendonly yes  # 生产环境请修改密码!
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  postgres-data:
  redis-data:
```

---

**部署完成!** 🎉

现在你可以从本地 Windows 开发机连接到 `192.168.100.207:5432` (PostgreSQL) 和 `192.168.100.207:6379` (Redis)。
