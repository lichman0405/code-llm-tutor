# Code Executor Deployment Document · Judge0 CE

**Version**: 2.0
**Creation Date**: 2024-11-04
**Update Date**: 2025-11-05
**Deployment Location**: Remote Server `192.168.100.207`


---

## Table of Contents

1. Overview and Architecture
2. 10-15 Minute Quick Deployment
3. Connect and Self-Test from Local Windows
4. Backend Integration (TypeScript Example)
5. Supported Languages and Query Methods
6. Common Operations Commands
7. Troubleshooting Guide
8. Performance Optimization Suggestions
9. Appendix: Production Recommended `docker-compose.yml`

---

## 1) Overview and Architecture

* 📍 **Execution Server**: `192.168.100.207` (Linux)
* 💻 **Development Environment**: Local Windows Computer
* 🔗 **Access Method**: Backend calls **Judge0 API** via HTTP
* 🧱 **Components**: Judge0 Server, Judge0 Workers, PostgreSQL, Redis

**Goal**: Complete setup in 10-15 minutes, then call `http://192.168.100.207:2358` from local to execute code.

### System Requirements

> **Important**: Judge0 is only tested on Linux, does not support other systems.

**Recommended System**: Ubuntu 22.04

**Required Configuration** (Switch to cgroup v1):

```bash
# 1. Edit GRUB configuration
sudo nano /etc/default/grub

# 2. Add to GRUB_CMDLINE_LINUX variable value:
#    systemd.unified_cgroup_hierarchy=0
# Example:
#    GRUB_CMDLINE_LINUX="systemd.unified_cgroup_hierarchy=0"

# 3. Apply changes
sudo update-grub

# 4. Reboot Server
sudo reboot
```

---

## 2) 10-15 Minute Quick Deployment

### Step 1: SSH to Server

```bash
ssh <username>@192.168.100.207
```

### Step 2: Install Docker (Skip if already installed)

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo systemctl start docker
sudo systemctl enable docker
```

### Step 3: Create Directory and Configuration Files

```bash
mkdir -p ~/codetutor/judge0
cd ~/codetutor/judge0
```

**3.1 `judge0.conf` (Environment Variables)**

```bash
cat > judge0.conf << 'EOF'
# --- Postgres (use trust to skip password) ---
POSTGRES_USER=judge0
POSTGRES_DB=judge0
POSTGRES_HOST=judge0-db
POSTGRES_PORT=5432
POSTGRES_HOST_AUTH_METHOD=trust

# --- Redis (no password by default) ---
REDIS_HOST=judge0-redis
REDIS_PORT=6379

# --- Judge0 Connection String (No Password) ---
DATABASE_URL=postgres://judge0@judge0-db:5432/judge0
REDIS_URL=redis://judge0-redis:6379/0
EOF
```

**(Optional) 3.2 Custom Image to Upgrade isolate**

> If the kernel is **cgroup v2**, it is recommended to compile a newer isolate (1.9.x+).

Directory and Dockerfile:

```bash
mkdir -p judge0-custom
cat > judge0-custom/Dockerfile << 'EOF'
FROM judge0/judge0:1.13.1

# Build isolate dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      git build-essential flex bison libcap-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Compile and install latest isolate (supports cgroup v2)
RUN git clone https://github.com/ioi/isolate.git /tmp/isolate && \
    cd /tmp/isolate && make && make install && \
    rm -rf /tmp/isolate

# Output version for verification (expect 1.9.x+)
RUN isolate --version
EOF
```

### Step 4: `docker-compose.yml`

> **Unified Version**: This article uses **Judge0 1.13.1**; `privileged: true` binds with cgroup to ensure isolation works properly.

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
    # In non-Swarm mode, deploy.replicas is invalid, for multiple replicas please use:
    # docker compose up -d --scale judge0-workers=2

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

### Step 5: Start and Verify

```bash
# 启动
docker compose up -d

# Wait for initialization on first startup
sleep 60

# Check Status and Logs
docker compose ps
docker compose logs --tail 50 judge0-server

# Health Check
curl http://localhost:2358/about

# Synchronous Execution (wait mode)
curl -s -X POST 'http://localhost:2358/submissions?base64_encoded=false&wait=true' \
  -H 'Content-Type: application/json' \
  -d '{
    "source_code": "print(\"Hello, Judge0!\")",
    "language_id": 71,
    "stdin": ""
  }' | jq '{status, stdout, stderr, message}'
```

> Expect `status.description` to be `Accepted`, `stdout` output `Hello, Judge0!`.

---

## 3) Connect and Self-test from Local Windows

**3.1 `.env`**

```env
JUDGE0_URL=http://192.168.100.207:2358
```

**3.2 Connectivity Test (PowerShell)**

```powershell
Test-NetConnection -ComputerName 192.168.100.207 -Port 2358
curl http://192.168.100.207:2358/about
```

---

## 4) Backend Integration (TypeScript Example)

**`backend/src/services/judge0.service.ts`**

```ts
import axios from 'axios';

const JUDGE0_URL = process.env.JUDGE0_URL || 'http://192.168.100.207:2358';

const LANGUAGE_IDS: Record<string, number> = {
  python: 71,
  javascript: 63,
  java: 62,
  cpp: 54,
  go: 60,
  typescript: 74,
};

export class Judge0Service {
  async submit(code: string, language: string, stdin = '') {
    const languageId = LANGUAGE_IDS[language.toLowerCase()];
    if (!languageId) throw new Error(`Unsupported language: ${language}`);

    const { data } = await axios.post(`${JUDGE0_URL}/submissions`, {
      source_code: code,
      language_id: languageId,
      stdin,
      cpu_time_limit: 2,
      memory_limit: 256000,
    }, { params: { base64_encoded: false } });

    return data.token as string;
  }

  async getResult(token: string) {
    const { data } = await axios.get(`${JUDGE0_URL}/submissions/${token}`, {
      params: { base64_encoded: false }
    });
    return {
      status: data.status?.description,
      stdout: data.stdout,
      stderr: data.stderr,
      time: data.time,
      memory: data.memory,
      compile_output: data.compile_output,
    } as const;
  }

  async execute(code: string, language: string, stdin = '') {
    const token = await this.submit(code, language, stdin);
    for (let i = 0; i < 20; i++) { // ~10s
      await new Promise(r => setTimeout(r, 500));
      const r = await this.getResult(token);
      if (r.status !== 'In Queue' && r.status !== 'Processing') return r;
    }
    throw new Error('Execution timeout');
  }

  async runTestCases(
    code: string,
    language: string,
    testCases: Array<{ input: string; expected: string }>
  ) {
    const results = [] as Array<any>;
    for (const tc of testCases) {
      try {
        const r = await this.execute(code, language, tc.input);
        const actual = r.stdout?.trim() ?? '';
        results.push({ ...tc, actual, passed: actual === tc.expected.trim(), status: r.status, time: r.time, memory: r.memory, error: r.stderr });
      } catch (e: any) {
        results.push({ ...tc, actual: '', passed: false, status: 'Error', error: e?.message });
      }
    }
    return results;
  }
}

export const judge0Service = new Judge0Service();
```

---

## 5) Supported Languages and Query Methods

Common languages (based on 1.13.x default image):

| Language    | Language ID | Version (Typical) |
| ---------- | ----------: | ------------ |
| Python     |          71 | 3.8.x        |
| JavaScript |          63 | Node.js 12.x |
| Java       |          62 | 13.x         |
| C++        |          54 | GCC 9（C++17） |
| Go         |          60 | 1.13.x       |
| TypeScript |          74 | 3.7.x        |

**Get Complete List**

```bash
curl http://192.168.100.207:2358/languages
```

---

## 6) Common Operations Commands

```bash
# Start / Stop / Restart
docker compose up -d
sleep 60
docker compose stop
docker compose restart

# Status and Logs
docker compose ps
docker compose logs -f judge0-server
docker compose logs -f judge0-workers

# Complete cleanup (including data volumes, use with caution)
docker compose down -v
```

---

## 7) 故障排查指南

### 7.1 服务启动异常（反复 restarting）

* **看日志**：`docker compose logs judge0-server`
* **常见原因**：

  1. 依赖服务未就绪 → 首次启动等待 1–2 分钟
  2. 权限不足 → 确保 `privileged: true` 与 cgroup 挂载
  3. 端口冲突 → 修改 `2358` 或释放占用

### 7.2 无法从本地连接

```bash
# 服务器端口监听
ss -tlnp | grep 2358
# 防火墙
sudo ufw status
```

Windows：

```powershell
Test-NetConnection -ComputerName 192.168.100.207 -Port 2358
```

### 7.3 代码执行失败 / 超时

* **查看 worker 日志**：`docker compose logs judge0-workers`
* **放宽限制（提交参数）**：`cpu_time_limit: 5`, `memory_limit: 512000`, `wall_time_limit: 10`
* **验证 isolate 与 cgroup**：

```bash
docker exec -it <workers-container> bash -lc 'isolate --version && stat -fc %T /sys/fs/cgroup'
# 期望输出：isolate 1.9.x+ 且 cgroup2fs
```

### 7.4 自定义镜像构建失败（git not found 等）

* 确认 Dockerfile 中已安装 `git` 与构建依赖（见示例）。

### 7.5 内部错误（Status 13）

* 逐条核查：isolate 版本、cgroup 类型、`/box` 与 `/tmp` 是否 `tmpfs` 且可执行、容器 `privileged`。

---

## 8) 性能优化建议

### 8.1 扩容 worker 数量

```bash
docker compose up -d --scale judge0-workers=4
```

### 8.2 资源限制（示例）

```yaml
judge0-server:
  deploy:
    resources:
      limits:
        cpus: "2"
        memory: 2G
      reservations:
        cpus: "1"
        memory: 1G
```

---

## 9) 附录：生产推荐 `docker-compose.yml`

> 与主体一致，便于复制粘贴；如需启用自定义 isolate，改用 `build: ./judge0-custom`。

```yaml
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
```

---

**安全提示**：务必在生产环境替换数据库/Redis 密码；必要时将 API 置于内网或网关后，并配置速率限制与鉴权。

**文档状态**：✅ 完成（2025-11-05）
