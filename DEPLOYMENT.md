# HR数字助手 - 部署指南

本文档详细说明如何将HR数字助手部署到生产环境。

## 📋 部署前准备

### 环境要求

**开发环境:**
- Node.js >= 18.17.0
- npm >= 9.0.0

**生产环境:**
- Node.js >= 18.17.0
- PM2 (推荐用于进程管理)
- 或 Docker + Docker Compose

### 必需资源

- Anthropic API Key
- 域名（可选）
- 服务器（VPS或云服务）

## 🚀 部署方式

### 方式1: Vercel部署（推荐）

#### 优点
- 零配置部署
- 自动HTTPS
- 全球CDN
- 持续部署

#### 步骤

1. **准备代码**
```bash
# 确保代码已提交到Git仓库
git add .
git commit -m "Ready for deployment"
git push
```

2. **部署到Vercel**

访问 [vercel.com](https://vercel.com) 并导入项目：
- 点击 "New Project"
- 导入Git仓库
- Vercel会自动检测Next.js项目

3. **配置环境变量**

在Vercel项目设置中添加：
```
ANTHROPIC_API_KEY=your_api_key_here
```

4. **部署**

点击 "Deploy" 按钮，等待部署完成

5. **访问**

Vercel会提供一个 `.vercel.app` 域名，也可以配置自定义域名

---

### 方式2: VPS部署（使用PM2）

#### 优点
- 完全控制
- 成本较低
- 可选配置更多

#### 步骤

1. **连接服务器**
```bash
ssh user@your-server-ip
```

2. **安装Node.js**
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

3. **安装PM2**
```bash
sudo npm install -g pm2
```

4. **克隆代码**
```bash
git clone <your-repo-url>
cd hr-assistant
```

5. **安装依赖**
```bash
npm install
```

6. **配置环境变量**
```bash
cat > .env.local << EOF
ANTHROPIC_API_KEY=your_api_key_here
EOF
```

7. **构建项目**
```bash
npm run build
```

8. **启动服务**
```bash
pm2 start npm --name "hr-assistant" -- start
pm2 save
pm2 startup
```

9. **配置Nginx（反向代理）**

创建Nginx配置：
```bash
sudo nano /etc/nginx/sites-available/hr-assistant
```

添加以下内容：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/hr-assistant /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

10. **配置SSL（使用Let's Encrypt）**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

### 方式3: Docker部署

#### 优点
- 环境隔离
- 易于扩展
- 跨平台

#### 步骤

1. **创建Dockerfile**
```bash
# 在项目根目录创建
cat > Dockerfile << EOF
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
EOF
```

2. **构建Docker镜像**
```bash
docker build -t hr-assistant:latest .
```

3. **运行容器**
```bash
docker run -d \\
  --name hr-assistant \\
  -p 3000:3000 \\
  -e ANTHROPIC_API_KEY=your_key \\
  hr-assistant:latest
```

4. **使用Docker Compose（推荐）**

创建 `docker-compose.yml`:
```yaml
version: '3.8'

services:
  hr-assistant:
    build: .
    ports:
      - "3000:3000"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

运行：
```bash
docker-compose up -d
```

---

## 🔧 环境变量配置

### 必需变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `ANTHROPIC_API_KEY` | Anthropic API密钥 | `sk-ant-xxx...` |

### 可选变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `NEXT_PUBLIC_APP_NAME` | 应用名称 | HR数字助手 |
| `NEXT_PUBLIC_APP_VERSION` | 应用版本 | 1.0.0 |

---

## 📊 监控和维护

### 日志查看

**PM2:**
```bash
pm2 logs hr-assistant
```

**Docker:**
```bash
docker logs hr-assistant
```

### 性能监控

使用PM2 Plus：
```bash
pm2 link <secret_key>
```

### 备份数据

数据存储在 `data/` 目录，定期备份：
```bash
tar -czf backup-$(date +%Y%m%d).tar.gz data/
```

### 更新部署

**Vercel:** 自动更新

**PM2:**
```bash
git pull
npm install
npm run build
pm2 restart hr-assistant
```

**Docker:**
```bash
docker-compose down
docker-compose pull
docker-compose up -d --build
```

---

## 🔒 安全建议

1. **API Key保护**
   - 使用环境变量存储
   - 不要提交到Git仓库
   - 定期轮换密钥

2. **HTTPS配置**
   - 生产环境必须使用HTTPS
   - 配置SSL证书

3. **访问控制**
   - 配置防火墙规则
   - 限制API访问频率

4. **数据备份**
   - 定期备份数据目录
   - 异地存储备份

---

## 🐛 常见部署问题

### 问题1: 端口被占用
```bash
# 查看占用端口的进程
lsof -i :3000
# 杀死进程
kill -9 <PID>
```

### 问题2: API Key无效
- 检查 `.env.local` 文件
- 验证API Key是否有效
- 确认账户有足够额度

### 问题3: 构建失败
```bash
# 清理缓存
rm -rf .next node_modules
npm install
npm run build
```

### 问题4: Docker容器无法启动
```bash
# 查看日志
docker logs hr-assistant

# 重新构建
docker-compose down
docker-compose up -d --build
```

---

## 📞 技术支持

如遇到部署问题，请：

1. 查看本文档的常见问题部分
2. 检查GitHub Issues
3. 提交新的Issue

---

**祝部署顺利！** 🎉
