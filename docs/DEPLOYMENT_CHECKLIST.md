# Deployment Checklist
# Remote Server 192.168.100.207

**Goal**: Deploy database and code executor on remote Linux server for local development machine use

**Estimated Time**: 30 minutes

---

## 📋 Pre-Deployment Preparation

### Server Information
- **IP Address**: 192.168.100.207
- **Operating System**: Linux (Ubuntu 22.04 LTS recommended)
- **User Permissions**: root or sudo permissions
- **SSH Access**: Ensure SSH login from local is possible

### Local Development Machine
- **Operating System**: Windows
- **Network**: Able to access 192.168.100.207

---

## ✅ Step 1: Deploy Database (PostgreSQL + Redis)

**Reference Document**: `DATABASE_DEPLOYMENT.md`
**Estimated Time**: 10 minutes

### 1.1 Connect to Server
```bash
ssh username@192.168.100.207
```

### 1.2 Install Docker (if not installed)
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo systemctl start docker
sudo systemctl enable docker

# Verify
docker --version
docker compose version
```

### 1.3 Create Deployment Directory
```bash
mkdir -p ~/codetutor/database
cd ~/codetutor/database
```

### 1.4 Create docker-compose.yml
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

### 1.5 Create init.sql
```bash
# Copy init.sql content from DATABASE_DEPLOYMENT.md
# Or download directly
wget https://raw.githubusercontent.com/yourusername/codetutor/main/docs/init.sql
```

### 1.6 Start Services
```bash
docker compose up -d

# Wait 30 seconds
sleep 30

# Check Status
docker compose ps

# Check Logs
docker compose logs
```

### 1.7 Verify Deployment (On Server)
```bash
# Test PostgreSQL
docker exec -it codetutor-postgres psql -U codetutor -d codetutor -c "\dt"

# Test Redis
docker exec -it codetutor-redis redis-cli -a redis123 PING
```

### 1.8 Test Remote Connection (From Local Windows)
```powershell
# Test Ports
Test-NetConnection -ComputerName 192.168.100.207 -Port 5432
Test-NetConnection -ComputerName 192.168.100.207 -Port 6379

# Test PostgreSQL (requires psql installation)
psql -h 192.168.100.207 -U codetutor -d codetutor

# Test Redis (using Docker)
docker run --rm -it redis:7-alpine redis-cli -h 192.168.100.207 -a redis123 PING
```

### ✅ Database Deployment Completed!

**Record Passwords** (Please change in production environment):
- PostgreSQL Password: `codetutor123`
- Redis Password: `redis123`

---

## ✅ Step 2: Deploy Judge0 Code Executor

**Reference Document**: `CODE_EXECUTOR_DEPLOYMENT.md`  
**Estimated Time**: 10 minutes

> **System Requirements**: Ubuntu 22.04 + cgroup v1 configuration (see CODE_EXECUTOR_DEPLOYMENT.md for details)

### 2.1 Configure cgroup v1 (Required)

```bash
# Edit GRUB
sudo nano /etc/default/grub

# Add: systemd.unified_cgroup_hierarchy=0
# Example: GRUB_CMDLINE_LINUX="systemd.unified_cgroup_hierarchy=0"

# Apply and reboot
sudo update-grub
sudo reboot
```

### 2.2 Create Deployment Directory
```bash
mkdir -p ~/codetutor/judge0
cd ~/codetutor/judge0
```

### 2.3 创建配置文件

**judge0.conf**:
```bash
cat > judge0.conf << 'EOF'
# --- Postgres（用 trust 跳过密码）---
POSTGRES_USER=judge0
POSTGRES_DB=judge0
POSTGRES_HOST=judge0-db
POSTGRES_PORT=5432
POSTGRES_HOST_AUTH_METHOD=trust

# --- Redis（默认无密码）---
REDIS_HOST=judge0-redis
REDIS_PORT=6379

# --- Judge0 连接串（不带密码）---
DATABASE_URL=postgres://judge0@judge0-db:5432/judge0
REDIS_URL=redis://judge0-redis:6379/0
EOF
```

**docker-compose.yml**:
```bash
cat > docker-compose.yml << 'EOF'
services:
  judge0-server:
    image: judge0/judge0:1.13.1
    env_file: judge0.conf
    ports:
      - "2358:2358"
    environment:
      ENABLE_WAIT_RESULT: "true"
      ENABLE_COMPILER_OPTIONS: "true"
    depends_on:
      judge0-db:
        condition: service_healthy
      judge0-redis:
        condition: service_healthy
    restart: unless-stopped
    privileged: true
    volumes:
      - /sys/fs/cgroup:/sys/fs/cgroup:rw

  judge0-workers:
    image: judge0/judge0:1.13.1
    command: ["./scripts/workers"]
    env_file: judge0.conf
    depends_on:
      judge0-db:
        condition: service_healthy
      judge0-redis:
        condition: service_healthy
    restart: unless-stopped
    privileged: true
    volumes:
      - /sys/fs/cgroup:/sys/fs/cgroup:rw
    tmpfs:
      - /tmp:exec,mode=777
      - /box:exec,mode=777

  judge0-db:
    image: postgres:16.2
    env_file: judge0.conf
    volumes:
      - judge0-postgres-data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -h 127.0.0.1 -p 5432"]
      interval: 5s
      timeout: 3s
      retries: 20

  judge0-redis:
    image: redis:7.2.4
    command: ["redis-server", "--appendonly", "no"]
    env_file: judge0.conf
    restart: unless-stopped
    volumes:
      - judge0-redis-data:/data
    healthcheck:
      test: ["CMD-SHELL", "redis-cli PING | grep -q PONG"]
      interval: 5s
      timeout: 3s
      retries: 20

volumes:
  judge0-postgres-data:
  judge0-redis-data:
EOF
```

### 2.4 启动服务
```bash
docker compose up -d
sleep 60
docker compose ps
```

### 2.5 验证部署 (在服务器上)
```bash
# 测试 API
curl http://localhost:2358/about

# 测试代码执行
curl -X POST http://localhost:2358/submissions \
  -H "Content-Type: application/json" \
  -d '{"source_code": "print(\"Hello\")", "language_id": 71}'
```

### 2.6 测试远程连接 (从本地 Windows)
```powershell
# 测试端口
Test-NetConnection -ComputerName 192.168.100.207 -Port 2358

# 测试 API
curl http://192.168.100.207:2358/about
```

### ✅ Judge0 部署完成!

---

## ✅ Step 3: Configure Local Development Environment

**Estimated Time**: 10 minutes

### 3.1 创建后端 .env 文件

在本地项目 `backend/.env`:

```env
# 数据库 (连接到远程服务器)
DATABASE_URL=postgresql://codetutor:codetutor123@192.168.100.207:5432/codetutor
REDIS_URL=redis://:redis123@192.168.100.207:6379

# Judge0 (连接到远程服务器)
JUDGE0_URL=http://192.168.100.207:2358

# 其他配置
JWT_SECRET=your-jwt-secret-change-this
NODE_ENV=development
PORT=3001
```

### 3.2 创建前端 .env.local 文件

在本地项目 `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3.3 测试连接

**后端测试**:
```powershell
cd backend
pnpm install

# 测试 Prisma 连接
npx prisma db pull
npx prisma generate

# 启动后端
pnpm dev
```

**前端测试**:
```powershell
cd frontend
pnpm install

# 启动前端
pnpm dev
```

---

## 📊 最终检查清单

### 服务器端 (192.168.100.207)

在服务器上运行:
```bash
# 检查所有容器
docker ps

# 应该看到以下容器都在运行:
# - codetutor-postgres
# - codetutor-redis
# - judge0-server-1
# - judge0-workers-1
# - judge0-db-1
# - judge0-redis-1
```

**检查项**:
- [ ] PostgreSQL 容器运行正常
- [ ] Redis 容器运行正常
- [ ] Judge0 Server 容器运行正常
- [ ] Judge0 Workers 容器运行正常
- [ ] 所有容器状态为 "Up"

### 本地开发机 (Windows)

在 PowerShell 运行:
```powershell
# 测试所有端口
Test-NetConnection -ComputerName 192.168.100.207 -Port 5432
Test-NetConnection -ComputerName 192.168.100.207 -Port 6379
Test-NetConnection -ComputerName 192.168.100.207 -Port 2358

# 测试 Judge0 API
curl http://192.168.100.207:2358/about
```

**检查项**:
- [ ] 能 ping 通服务器
- [ ] 端口 5432 可访问 (PostgreSQL)
- [ ] 端口 6379 可访问 (Redis)
- [ ] 端口 2358 可访问 (Judge0)
- [ ] Judge0 API 返回正确的 JSON
- [ ] 后端 `.env` 配置正确
- [ ] 前端 `.env.local` 配置正确
- [ ] `npx prisma db pull` 成功
- [ ] 后端服务启动成功
- [ ] 前端服务启动成功

---

## 🎉 部署完成!

### 连接信息汇总

**数据库**:
- PostgreSQL: `192.168.100.207:5432`
  - 用户: `codetutor`
  - 密码: `codetutor123`
  - 数据库: `codetutor`
- Redis: `192.168.100.207:6379`
  - 密码: `redis123`

**代码执行器**:
- Judge0 API: `http://192.168.100.207:2358`

**本地开发**:
- 后端: `http://localhost:3001`
- 前端: `http://localhost:3000`

### 下一步

参考 `DEVELOPMENT_GUIDE.md` 开始 **阶段 1: MVP 开发**!

---

## 🔧 常见问题

### Q: 容器启动失败?
```bash
# 查看日志
docker compose logs -f

# 重新启动
docker compose down
docker compose up -d
```

### Q: 无法从本地连接?
```bash
# 在服务器上检查端口
netstat -tlnp | grep 5432
netstat -tlnp | grep 6379
netstat -tlnp | grep 2358

# 检查 Docker 网络
docker network ls
docker network inspect <network-name>
```

### Q: Judge0 一直 restarting?
```bash
# 查看详细日志
docker compose logs judge0-server

# 等待更长时间 (可能需要 2-3 分钟初始化)
sleep 120
docker compose ps
```

---

## 🔒 生产环境提醒

当前配置适用于开发环境。生产环境部署时请:

1. **修改所有默认密码**
2. **配置 SSL/TLS**
3. **启用访问控制**
4. **配置备份策略**
5. **启用监控和日志**

详见各部署文档的完整说明。

---

**祝部署顺利!** 🚀
