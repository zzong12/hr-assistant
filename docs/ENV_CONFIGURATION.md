# 🔧 环境变量配置指南

本文档详细说明如何配置HR数字助手的环境变量。

## 📋 配置步骤

### 步骤1: 创建环境变量文件

```bash
# 复制模板文件
cp .env.local.example .env.local

# 或者直接创建新文件
touch .env.local
```

### 步骤2: 配置Anthropic API Key

1. **获取API Key**
   - 访问 [Anthropic Console](https://console.anthropic.com/)
   - 注册或登录账户
   - 创建新的API Key
   - 复制API Key（格式: `sk-ant-xxxxx`）

2. **配置到.env.local**
   ```bash
   # 编辑 .env.local 文件
   nano .env.local
   # 或使用其他编辑器：VSCode、vim等
   ```

   添加以下内容：
   ```bash
   ANTHROPIC_API_KEY=sk-ant-xxxxx
   ```

### 步骤3: 验证配置

运行环境检查脚本：
```bash
npm run check-env
```

您应该看到：
```
✅ ANTHROPIC_API_KEY = sk-ant-...xxxx
✅ 环境检查通过！
```

## 🔑 核心环境变量说明

### 必需配置

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `ANTHROPIC_API_KEY` | Anthropic API密钥 | `sk-ant-api123...` |

### 重要配置（推荐）

| 变量名 | 说明 | 默认值 | 建议值 |
|--------|------|--------|--------|
| `NODE_ENV` | 运行环境 | `development` | 生产环境用 `production` |
| `DEFAULT_CLAUDE_MODEL` | 使用的Claude模型 | `claude-3-5-sonnet-20241022` | 根据需求选择 |
| `TEMPERATURE` | AI响应随机性（0-1） | `0.7` | 创意性高用 `0.9`，精确性高用 `0.3` |
| `MAX_TOKENS` | 最大响应Token数 | `4096` | 简单任务用 `1024`，复杂任务用 `8192` |

### 功能开关

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `ENABLE_AI_FEATURES` | 启用AI功能 | `true` |
| `ENABLE_RESUME_PARSING` | 启用简历解析 | `true` |
| `ENABLE_INTERVIEW_REMINDERS` | 启用面试提醒 | `false` |
| `ENABLE_ANALYTICS` | 启用数据分析 | `false` |

### 性能调优

| 变量名 | 说明 | 默认值 | 优化建议 |
|--------|------|--------|----------|
| `API_CACHE_TTL` | API缓存时间（秒） | `300` | 生产环境用 `600` |
| `RATE_LIMIT_PER_MINUTE` | 每分钟请求限制 | `60` | 公开服务用 `30` |
| `CONVERSATION_HISTORY_LIMIT` | 对话历史保留轮数 | `10` | 上下文重要用 `20` |

## 🌍 多环境配置

### 开发环境 (.env.local)
```bash
NODE_ENV=development
DEBUG=true
VERBOSE_LOGGING=true
ENABLE_DEV_TOOLBAR=true
```

### 生产环境 (.env.production)
```bash
NODE_ENV=production
DEBUG=false
VERBOSE_LOGGING=false
ENABLE_DEV_TOOLBAR=false
RATE_LIMIT_PER_MINUTE=30
```

### 测试环境 (.env.test)
```bash
NODE_ENV=test
DEBUG=false
ENABLE_AI_FEATURES=false  # 使用Mock数据
```

## 🔐 安全最佳实践

### 1. 永远不要提交API Key到代码库
```bash
# .gitignore 中已包含
.env.local
.env.*.local
```

### 2. 使用不同的API Key
- 开发环境使用测试Key
- 生产环境使用正式Key
- 定期轮换API Key

### 3. 限制API Key权限
- 仅授予必要的权限
- 设置使用限额
- 监控异常使用

### 4. 环境变量加密（生产环境）
```bash
# 使用加密工具
sudo apt install ansible-vault
ansible-vault encrypt_string "API_KEY_VALUE" --vault-password-file vault.pass
```

## 🧪 测试配置

### 测试API Key是否有效
```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### 测试应用是否能正常加载环境变量
```bash
npm run check-env
```

## 🚨 常见问题

### Q1: 提示 "Missing required environment variable: ANTHROPIC_API_KEY"
**A**:
- 检查 `.env.local` 文件是否存在
- 确认文件中包含了 `ANTHROPIC_API_KEY=sk-ant-xxxxx`
- 重启开发服务器

### Q2: API调用失败
**A**:
- 验证API Key格式正确（以 `sk-ant-` 开头）
- 检查API Key是否有效
- 确认账户有足够额度
- 查看浏览器控制台的网络请求

### Q3: 环境变量更新后不生效
**A**:
- 停止开发服务器（Ctrl+C）
- 重新启动 `npm run dev`
- 或使用Turbopack热重载

### Q4: 生产部署时环境变量丢失
**A**:
- 在部署平台配置环境变量
- Vercel: Project Settings → Environment Variables
- Docker: 在 `docker-compose.yml` 中配置
- VPS: 确保 `.env.local` 文件存在

## 📚 更多信息

- [Anthropic API文档](https://docs.anthropic.com/)
- [Next.js环境变量](https://nextjs.org/docs/basic-features/environment-variables)
- [.env文件规范](https://dotenvlinter.com/)

---

**配置完成后，运行 `npm run check-env` 验证配置正确性！**
