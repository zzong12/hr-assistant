# Nexus HR 部署文档

## 概述

Nexus HR 使用 Docker + Docker Compose 进行容器化部署，镜像托管在阿里云容器镜像服务（ACR）。

## 基本信息

| 项目 | 值 |
|------|-----|
| 镜像地址 | `registry.cn-hangzhou.aliyuncs.com/openz/hr-assistant:latest` |
| 远程服务器 | `115.191.30.167` |
| SSH 用户 | `zhaozhong`（密码 `admin666`，可 `su` 切 root） |
| 部署目录 | `/home/zhaozhong/workspace/hr-assistant` |
| 服务端口 | `3000` |
| 访问地址 | `http://115.191.30.167:3000` |
| 登录账号 | `admin` / `admin666`（在 `.env.local` 中配置） |

## 目录结构

```
/home/zhaozhong/workspace/hr-assistant/
├── docker-compose.yml    # 容器编排配置
├── .env.local            # 环境变量（API Key、认证等）
└── data/                 # 持久化数据（SQLite DB + 简历文件）
    ├── hr-assistant.db
    └── resumes/
```

## 部署流程

### 前提条件

- 本地已安装 Docker Desktop 且已登录阿里云 ACR（`docker login registry.cn-hangzhou.aliyuncs.com`）
- 本地已配置 SSH 免密或知晓密码
- 远程服务器已安装 Docker 和 docker-compose

### 方式一：使用部署脚本（一键）

```bash
cd /Users/jason/Projects/wanlianyida/hr-assistant
bash scripts/deploy.sh
```

脚本会依次执行：构建镜像 -> 推送 ACR -> 上传配置 -> 上传数据 -> 远程拉取并启动。

> 注意：脚本中的 `scp -r data/` 会覆盖远程数据，如果不想覆盖远程已有数据，注释掉 Step 5。

### 方式二：分步手动执行

#### 1. 构建镜像

```bash
cd /Users/jason/Projects/wanlianyida/hr-assistant
docker build --platform linux/amd64 -t registry.cn-hangzhou.aliyuncs.com/openz/hr-assistant:latest .
```

- `--platform linux/amd64`：远程服务器是 x86 架构，macOS ARM 需要交叉编译
- 构建约需 1-2 分钟

#### 2. 推送镜像

```bash
docker push registry.cn-hangzhou.aliyuncs.com/openz/hr-assistant:latest
```

#### 3. 上传配置文件到远程

```bash
scp docker-compose.yml zhaozhong@115.191.30.167:/home/zhaozhong/workspace/hr-assistant/
scp .env.local zhaozhong@115.191.30.167:/home/zhaozhong/workspace/hr-assistant/
```

> **重要**：上传前确保 `.env.local` 中的以下字段已适配生产环境：
> - `HOSTNAME=0.0.0.0`（不能是 `localhost`，否则外部无法访问）
> - `NODE_ENV=production`

#### 4. （可选）上传本地数据

```bash
scp -r data/ zhaozhong@115.191.30.167:/home/zhaozhong/workspace/hr-assistant/
```

#### 5. 远程拉取镜像并启动

```bash
ssh zhaozhong@115.191.30.167
cd /home/zhaozhong/workspace/hr-assistant

# 需要 sudo 权限执行 docker 命令
sudo docker pull registry.cn-hangzhou.aliyuncs.com/openz/hr-assistant:latest
sudo docker-compose down
sudo docker-compose up -d
```

#### 6. 验证部署

```bash
# 查看容器状态
sudo docker-compose ps

# 检查日志
sudo docker-compose logs -f --tail=50

# 测试登录接口
curl -s -X POST http://localhost:3000/api/auth \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin666"}'
# 期望返回: {"success":true,"username":"admin"}
```

## 关键配置文件

### docker-compose.yml

```yaml
services:
  hr-assistant:
    image: registry.cn-hangzhou.aliyuncs.com/openz/hr-assistant:latest
    container_name: hr-assistant
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    environment:
      - NODE_ENV=production
      - HOSTNAME=0.0.0.0
      - PORT=3000
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
```

### .env.local 关键字段

| 字段 | 说明 | 生产环境值 |
|------|------|-----------|
| `AUTH_USERNAME` | 登录用户名 | `admin` |
| `AUTH_PASSWORD` | 登录密码 | `admin666` |
| `ANTHROPIC_API_KEY` | AI API 密钥 | 当前使用智谱 API 代理 |
| `ANTHROPIC_BASE_URL` | AI API 地址 | `https://open.bigmodel.cn/api/anthropic` |
| `HOSTNAME` | 监听地址 | **必须** `0.0.0.0` |
| `NODE_ENV` | 运行环境 | `production` |
| `PORT` | 监听端口 | `3000` |

### Dockerfile 要点

- 基础镜像 `node:22-alpine`，多阶段构建（deps -> builder -> runner）
- `serverExternalPackages`（`better-sqlite3`、`pdf-parse`）需在 runner 阶段手动 COPY
- standalone 输出模式，最终镜像仅包含运行所需文件
- 应用以非 root 用户 `nextjs` 运行

## 常见问题排查

### 无法登录 / 页面无响应

1. 检查 `.env.local` 中 `HOSTNAME` 是否为 `0.0.0.0`（不能是 `localhost`）
2. 检查 `AUTH_USERNAME` 和 `AUTH_PASSWORD` 是否正确配置
3. 查看容器日志：`sudo docker-compose logs -f`

### 页面能访问但 AI 功能报错

1. 检查 `ANTHROPIC_API_KEY` 和 `ANTHROPIC_BASE_URL` 是否正确
2. 确认远程服务器能访问 AI API 地址：`curl -I https://open.bigmodel.cn`

### PDF 简历上传失败

确认 Dockerfile 中已包含 `pdf-parse` 模块的 COPY 指令：
```dockerfile
COPY --from=deps /app/node_modules/pdf-parse ./node_modules/pdf-parse
```

### 数据丢失

数据通过 Docker volume 挂载在 `./data` 目录：
- `docker-compose down` 不会删除数据
- `docker-compose down -v` **会** 删除 volumes，慎用
- 建议定期通过系统设置页面的"备份数据"功能导出

### 容器启动后立即退出

```bash
sudo docker-compose logs hr-assistant
```
常见原因：`better-sqlite3` 原生模块架构不匹配（需确保用 `--platform linux/amd64` 构建）。

## 更新部署

当代码有变更时，重新走一遍部署流程即可：

```bash
# 本地
docker build --platform linux/amd64 -t registry.cn-hangzhou.aliyuncs.com/openz/hr-assistant:latest .
docker push registry.cn-hangzhou.aliyuncs.com/openz/hr-assistant:latest

# 远程
ssh zhaozhong@115.191.30.167
cd /home/zhaozhong/workspace/hr-assistant
sudo docker pull registry.cn-hangzhou.aliyuncs.com/openz/hr-assistant:latest
sudo docker-compose down && sudo docker-compose up -d
```

如果配置文件有变动，需要先在本地修改后 `scp` 到远程再重启。
