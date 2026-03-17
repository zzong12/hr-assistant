# HR 数字助手

基于 AI 多 Agent 架构的智能 HR 招聘助手，定位为 **HR 数字员工**——通过自然语言对话驱动招聘全流程，支持飞书双向通信，可作为后台长期运行的智能服务。

## 项目简介

HR 数字助手将传统的表单驱动型 HR 系统升级为 **对话式 AI 工作台**。HR 只需通过聊天、拖拽简历、粘贴链接等自然交互方式，即可完成职位发布、简历筛选、面试安排和候选人评估的完整闭环。

核心设计原则：

- **对话优先**：所有操作均可通过自然语言完成，减少表单填写
- **AI 深度参与**：简历解析、岗位匹配、面试题生成、反馈分析全部由 AI 驱动
- **双面分析**：所有评估同时输出正面（优势）和反面（风险）分析
- **主动服务**：后台任务处理完成后通过飞书主动通知

### 功能全景

| 模块 | 功能 |
|------|------|
| 智能对话 | 自然语言交互、AI 自动识别意图并执行操作（创建职位/分析简历/安排面试） |
| 职位管理 | 自由文本/URL 抓取生成 JD、AI 智能补全、BOSS 直聘等平台链接解析 |
| 候选人管理 | 拖拽上传简历（PDF/TXT）、粘贴文本 AI 解析、一键匹配全部职位、评分筛选 |
| 面试管理 | AI 生成面试题（含关键点分级）、语音实时转录+AI 助手、自定义评估维度 |
| 飞书集成 | 双向通信——在飞书中发消息/简历即可触发 AI 处理，结果自动回复 |
| 数据看板 | 活跃职位、候选人统计、今日面试、待处理任务一览 |

## 技术栈

### 前端

| 技术 | 用途 |
|------|------|
| Next.js 16 (App Router) | 全栈框架，SSR + API Routes |
| React 19 | UI 渲染 |
| TypeScript 5 | 类型安全 |
| Tailwind CSS 4 | 样式方案 |
| shadcn/ui (Radix) | 组件库 |
| Zustand | 轻量状态管理 |
| Lucide React | 图标库 |

### 后端

| 技术 | 用途 |
|------|------|
| Next.js API Routes | RESTful 接口 |
| Anthropic Claude SDK | AI 多 Agent 系统 |
| better-sqlite3 | 嵌入式数据库 |
| pdf-parse | PDF 简历解析 |
| cheerio | URL 页面抓取解析 |
| @larksuiteoapi/node-sdk | 飞书双向通信 |

### 架构

```
┌──────────────────────────────────────────────────────────┐
│                      客户端 (React)                       │
│  ChatInterface │ JobsPage │ CandidatesPage │ Interviews  │
└────────┬─────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│                   Next.js API Routes                      │
│  /api/chat │ /api/jobs │ /api/candidates │ /api/interviews│
└────────┬──────────────┬──────────────────────────────────┘
         │              │
         ▼              ▼
┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐
│ AI Agents   │  │ SQLite (DB)  │  │ 飞书 Webhook/API    │
│ ├ Concierge │  │ jobs         │  │ 双向消息            │
│ ├ JD 生成   │  │ candidates   │  │ 文件接收            │
│ ├ 简历筛选  │  │ interviews   │  │ 卡片回复            │
│ ├ 面试协调  │  │ conversations│  └─────────────────────┘
│ └ 沟通专员  │  │ settings     │
└─────────────┘  └──────────────┘
```

## 快速开始

### 环境要求

- Node.js >= 22
- npm >= 9
- Anthropic API Key（或兼容接口）

### 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local，填入 API Key

# 启动开发服务器
npm run dev

# 访问 http://localhost:3000
```

### 环境变量

在 `.env.local` 中配置：

```bash
# 必填 - AI 服务
ANTHROPIC_API_KEY=your_api_key
ANTHROPIC_BASE_URL=https://api.anthropic.com    # 或兼容接口地址
DEFAULT_CLAUDE_MODEL=claude-3-5-sonnet-20241022

# 可选 - 飞书集成
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_WEBHOOK_URL=https://open.feishu.cn/...

# 可选 - 应用配置
PORT=3000
DATA_DIR=./data
MAX_TOKENS=4096
```

完整配置说明见 [docs/ENV_CONFIGURATION.md](docs/ENV_CONFIGURATION.md)。

## 部署

### Docker Compose 部署（推荐）

项目提供 Docker 镜像和 docker-compose 配置，一键部署：

```bash
# 1. 准备目录
mkdir -p hr-assistant/data && cd hr-assistant

# 2. 下载配置文件
# 将 docker-compose.yml 和 .env.local 放到当前目录

# 3. 启动
docker-compose up -d

# 4. 查看状态
docker-compose ps
docker-compose logs -f
```

`docker-compose.yml` 内容：

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
    volumes:
      - ./data:/app/data
```

### 本地构建镜像

```bash
# 构建（在项目根目录）
docker build -t hr-assistant .

# 推送到阿里云（可选）
docker tag hr-assistant registry.cn-hangzhou.aliyuncs.com/openz/hr-assistant:latest
docker push registry.cn-hangzhou.aliyuncs.com/openz/hr-assistant:latest
```

### 一键部署脚本

```bash
# 构建 → 推送 → 上传数据 → 远程启动
bash scripts/deploy.sh
```

脚本自动执行：构建 amd64 镜像 → 推送至阿里云 Registry → SCP 上传配置和数据 → SSH 远程拉取并启动。

### 数据持久化

所有数据存储在 `./data/` 目录：

```
data/
├── hr-assistant.db      # SQLite 主数据库
├── hr-assistant.db-wal  # WAL 日志
├── hr-assistant.db-shm  # 共享内存
└── resumes/             # 上传的简历文件
```

备份只需复制整个 `data/` 目录。迁移时将该目录放到新环境的同一路径下即可。

## API 接口

### 对话

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat` | 发送消息（流式响应） |

### 职位

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/jobs` | 职位列表 |
| POST | `/api/jobs` | 创建职位 |
| PUT | `/api/jobs` | 更新职位 |
| DELETE | `/api/jobs?id=xxx` | 删除职位 |
| POST | `/api/jobs/generate` | AI 生成 JD（支持 URL/自由文本） |

### 候选人

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/candidates` | 候选人列表 |
| POST | `/api/candidates` | 创建候选人 |
| POST | `/api/candidates/upload` | 上传简历（multipart） |
| POST | `/api/candidates/[id]/analyze` | AI 简历分析 |
| POST | `/api/candidates/[id]/match` | 匹配指定职位 |
| POST | `/api/candidates/[id]/match-all` | 一键匹配所有活跃职位 |

### 面试

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/interviews` | 面试列表 |
| POST | `/api/interviews` | 创建面试 |
| POST | `/api/interviews/[id]/generate-questions` | AI 生成面试题（含关键点分级） |
| POST | `/api/interviews/[id]/feedback` | 提交反馈（支持 AI 自由文本模式） |
| POST | `/api/interviews/[id]/voice-assist` | 语音转录 AI 分析 |

### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/settings` | 应用设置 |
| POST | `/api/feishu/webhook` | 飞书事件回调 |
| GET/POST | `/api/data` | 数据管理（统计/导出/清空） |

## AI Agent 系统

系统包含 5 个专业 Agent，由主控 Agent 根据用户意图自动路由：

| Agent | 职责 |
|-------|------|
| HR Concierge | 意图识别、任务路由、数据查询、操作执行 |
| JD 生成专员 | 职位描述撰写、优化、市场化薪资建议 |
| 简历筛选专员 | 简历解析、技能提取、匹配度评估（正反双面分析） |
| 面试协调专员 | 面试流程设计、题目生成（含关键点+等级）、评估（正反双面分析） |
| 候选人沟通专员 | 面试邀约、反馈通知、Offer 沟通、薪资谈判话术 |

## 项目结构

```
├── app/
│   ├── (main)/              # 主布局路由组
│   │   ├── page.tsx         # 首页（对话 + 数据面板）
│   │   ├── jobs/            # 职位管理
│   │   ├── candidates/      # 候选人管理
│   │   ├── interviews/      # 面试管理
│   │   ├── history/         # 历史记录
│   │   └── settings/        # 设置
│   ├── api/                 # API 路由
│   ├── layout.tsx           # 根布局
│   └── globals.css          # 全局样式
├── components/
│   ├── ChatInterface.tsx    # 聊天界面
│   ├── Sidebar.tsx          # 侧边导航
│   ├── InfoPanel.tsx        # 数据面板
│   ├── VoiceAssistant.tsx   # 语音识别助手
│   └── ui/                  # shadcn/ui 组件
├── lib/
│   ├── agents.ts            # AI Agent 定义和管理
│   ├── storage.ts           # SQLite 数据库操作
│   ├── types.ts             # TypeScript 类型定义
│   ├── feishu.ts            # 飞书 SDK 封装
│   ├── notify.ts            # 通知服务
│   └── *-utils.ts           # 各类工具函数
├── store/
│   └── useStore.ts          # Zustand 全局状态
├── scripts/
│   ├── deploy.sh            # 一键部署脚本
│   └── check-env.js         # 环境变量检查
├── Dockerfile               # 多阶段构建
├── docker-compose.yml       # 容器编排
└── data/                    # 数据目录（git ignored）
```

## 可用脚本

```bash
npm run dev        # 启动开发服务器
npm run build      # 生产构建
npm start          # 启动生产服务
npm run typecheck  # TypeScript 类型检查
npm run lint       # ESLint 代码检查
```

## License

MIT
