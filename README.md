# Nexus HR

基于 AI 多 Agent 架构的智能招聘工作台，定位为 **HR 数字员工**：通过自然语言对话驱动职位发布、简历筛选、面试安排与反馈沉淀的完整流程。

## 项目定位

Nexus HR 不是传统表单系统，而是对话优先的招聘操作系统：

- 对话驱动：输入自然语言即可触发业务操作。
- AI 深度参与：JD 生成、简历分析、匹配评估、面试题与反馈均由 AI 参与。
- 业务闭环：从职位到候选人到面试到复盘，数据统一沉淀到 SQLite。
- 可部署运行：支持本地开发、Docker 部署、远程长期运行。

## 功能亮点

### 当前版本与核心能力

- 当前版本：`v2.1.0`
- 核心能力：
  - 首页 Chat 支持英文 `/command`（如 `/jd`、`/resume`、`/interview`）指定 Agent。
  - 候选人精准匹配支持“多候选人 × 多职位”批量任务。
  - 对话与偏好数据以数据库为准（DB SoT）。
  - 全站文本录入支持语音输入（浏览器支持时）。

### 业务模块

- 智能对话：意图识别、Agent 路由、操作执行。
- 职位管理：自由文本/链接生成 JD、规则化评分参考。
- 候选人管理：简历上传解析、AI 分析、岗位匹配与状态流转。
- 面试管理：面试安排、题库生成、语音辅助、反馈沉淀。
- 历史与设置：会话资产管理、系统配置、飞书集成。

## 界面预览

### 对话入口

![首页对话](/docs/screenshot/main-chat.png)

首页负责统一入口：自然语言交互、指令调用、文档上传与任务回显。

### 职位管理

![职位主页面](/docs/screenshot/jobs-main.png)

职位模块支持职位全生命周期维护，集中管理 JD 与评分规则。

![职位匹配与评估](/docs/screenshot/jobs-match.png)

可在职位维度查看候选人匹配结果、评分细项与分析理由。

### 候选人与简历

![候选人与简历详情](/docs/screenshot/resume-view.png)

候选人页面支持简历解析、信息编辑、标签化筛选与状态流转。

![简历匹配与面试衔接](/docs/screenshot/resume-interview.png)

可从候选人直接进入匹配与面试协同，减少跨页面切换。

### 评分与历史

![评分规则管理](/docs/screenshot/scoring-split.png)

评分规则支持维度化拆分，便于团队统一评估标准。

![历史记录列表](/docs/screenshot/history.png)

历史页用于沉淀会话与操作轨迹，支持检索与管理。

![历史对话详情](/docs/screenshot/history-chat.png)

单会话可查看完整上下文，便于复盘与知识再利用。

### 设置页

![系统设置](/docs/screenshot/setting.png)

设置页包含通知、集成与运行参数，支持生产环境运维配置。

## 快速开始

### 环境要求

- Node.js >= 22
- npm >= 9
- 可用的 Anthropic API Key（或兼容接口）

### 最短路径

```bash
# 1) 安装依赖
npm install

# 2) 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local，至少填入 ANTHROPIC_API_KEY

# 3) 启动开发环境
npm run dev

# 4) 访问
# http://localhost:3000
```

## Docker 部署

### docker-compose（推荐）

```bash
docker-compose up -d
docker-compose ps
docker-compose logs -f
```

示例 `docker-compose.yml`：

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

### 数据持久化

```text
data/
├── hr-assistant.db
├── hr-assistant.db-wal
├── hr-assistant.db-shm
└── resumes/
```

迁移或备份时，直接复制整个 `data/` 目录即可。

## 配置说明

`.env.local` 常用配置：

```bash
# AI
ANTHROPIC_API_KEY=your_api_key
ANTHROPIC_BASE_URL=https://api.anthropic.com
DEFAULT_CLAUDE_MODEL=claude-3-5-sonnet-20241022

# App
PORT=3000
DATA_DIR=./data
MAX_TOKENS=4096

# Feishu (可选)
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_WEBHOOK_URL=https://open.feishu.cn/...
```

## API 概览

### 高频接口

- `POST /api/chat`：聊天请求（支持流式与 `forcedAgent`）
- `GET/POST/PUT/DELETE /api/jobs`：职位管理
- `GET/POST/PUT/DELETE /api/candidates`：候选人管理
- `POST /api/candidates/upload`：上传简历
- `POST /api/interviews`：创建面试

### 低频接口索引

- `/api/jobs/generate`
- `/api/jobs/scoring-rule`
- `/api/candidates/[id]/analyze`
- `/api/candidates/[id]/match`
- `/api/candidates/[id]/match-all`
- `/api/candidates/match-batch`
- `/api/interviews/[id]/generate-questions`
- `/api/interviews/[id]/feedback`
- `/api/interviews/[id]/voice-assist`
- `/api/conversations`
- `/api/preferences`
- `/api/settings`
- `/api/feishu/webhook`

## 架构与目录

### 技术栈

- 前端：Next.js 16、React 19、TypeScript 5、Tailwind CSS 4、shadcn/ui、Zustand
- 后端：Next.js API Routes、Anthropic SDK、better-sqlite3
- 解析能力：PDF/Word/TXT 简历解析
- 集成：飞书通知与双向通信

### 项目目录

```text
app/           # 页面与 API 路由
components/    # 业务组件与 UI 组件
lib/           # Agent、存储、业务工具
store/         # 前端状态管理
docs/          # 部署与配置文档、截图
scripts/       # 自动化脚本
```

## 常用命令

```bash
npm run dev        # 开发
npm run build      # 生产构建
npm start          # 生产启动
npm run typecheck  # 类型检查
npm run lint       # 代码检查
```

## 更多文档

- [部署文档](docs/DEPLOYMENT.md)
- [环境配置文档](docs/ENV_CONFIGURATION.md)

## License

MIT
