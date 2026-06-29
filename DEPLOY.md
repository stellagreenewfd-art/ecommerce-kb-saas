# 电商知识库 SaaS 部署指南

本项目为 Node.js + Express + SQLite 后端服务，需部署到支持 Node.js 运行的 PaaS 平台。

## 🚀 最快方式：一键部署脚本

已为你准备好自动部署脚本：`deploy-to-render.sh`

```bash
cd /Users/qinaqiang/WorkBuddy/2026-06-13-22-26-14/ecommerce-kb
bash deploy-to-render.sh
```

详细使用说明见：`DEPLOY-QUICK.md`

- 有 `GITHUB_TOKEN` + `RENDER_API_KEY` → **全自动**创建仓库+部署
- 没有 Token → **半自动**：手动建 GitHub 仓库，脚本推送代码并生成 Render 部署链接

---

## 推荐平台

| 平台 | 费用 | 持久化 SQLite | 难度 | 推荐度 |
|---|---|---|---|---|
| Render | 免费版可用 | 需配置 Disk | 低 | ⭐⭐⭐⭐⭐ |
| Railway | 有免费额度 | 需配置 Volume | 低 | ⭐⭐⭐⭐ |
| 阿里云/腾讯云服务器 | ¥60-200/年 | 本机磁盘 | 中 | ⭐⭐⭐⭐⭐（长期） |

> 注意：CloudStudio 只支持纯静态网站，**无法运行 Node.js 后端**，因此不适用本项目。

---

## 方案一：Render（推荐，5 分钟上线）

### 1. 准备代码仓库

1. 在 GitHub 上新建仓库，例如 `ecommerce-kb-saas`。
2. 将 `/Users/qinaqiang/WorkBuddy/2026-06-13-22-26-14/ecommerce-kb/` 目录下代码推送到仓库。
3. 确认仓库根目录包含 `server.js`、`package.json`、`render.yaml`。

### 2. 注册并登录 Render

访问 https://render.com ，使用 GitHub 账号登录。

### 3. 创建 Web Service

1. 点击 **New +** → **Web Service**。
2. 选择你的 GitHub 仓库 `ecommerce-kb-saas`。
3. Render 会自动识别 `render.yaml`（Blueprint），点击 **Apply**。

### 4. 配置环境变量

在 Render 控制台进入服务 **Environment** 标签页，添加：

| 变量名 | 值 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | `sk-ba0219fb9677478081deaf4f6d7931ca` | 你的 DeepSeek API Key |
| `JWT_SECRET` | 任意 32 位以上随机字符串 | JWT 签名密钥 |
| `PORT` | `3000` | 服务端口 |

> `render.yaml` 中已预配置 `DB_PATH=/var/data/app.db` 和 1GB Disk，SQLite 数据会自动持久化。

### 5. 部署完成

等待构建（约 2-3 分钟），完成后 Render 会给出类似：

```
https://ecommerce-kb-saas-xxx.onrender.com
```

访问：
- 前台：`https://你的域名/`
- 后台：`https://你的域名/admin.html`
- 管理员账号：`qaq` / `qaq881205`

---

## 方案二：Railway

### 1. 准备仓库

同 Render，将代码推送到 GitHub。

### 2. 注册 Railway

访问 https://railway.app ，使用 GitHub 登录。

### 3. 创建项目

1. 点击 **New Project** → **Deploy from GitHub repo**。
2. 选择 `ecommerce-kb-saas` 仓库。

### 4. 配置环境变量

进入项目 **Variables** 标签页，添加：

| 变量名 | 值 |
|---|---|
| `DEEPSEEK_API_KEY` | `sk-ba0219fb9677478081deaf4f6d7931ca` |
| `JWT_SECRET` | 随机字符串 |
| `PORT` | `3000` |
| `DB_PATH` | `/app/data/app.db` |

### 5. 添加持久化 Volume（重要）

Railway 免费实例文件系统不持久化，必须添加 Volume：

1. 点击 **New** → **Add Volume**。
2. Mount Path 设置为 `/app/data`。
3. 在 Service 设置中将 Volume 挂载到 `/app/data`。

### 6. 生成域名

部署完成后，进入 **Settings** → **Domains** → **Generate Domain**，获得公网链接。

---

## 方案三：自有云服务器（长期稳定）

### 1. 购买服务器

推荐阿里云/腾讯云轻量应用服务器（2核4G，Ubuntu 22.04）。

### 2. 上传代码

```bash
# 本地打包
zip -r ecommerce-kb.zip ecommerce-kb/

# 上传到服务器后解压
unzip ecommerce-kb.zip
cd ecommerce-kb
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入 DEEPSEEK_API_KEY 和 JWT_SECRET
```

### 4. 使用 PM2 守护进程

```bash
npm install -g pm2
pm2 start server.js --name ecommerce-kb
pm2 save
pm2 startup
```

### 5. Nginx 反向代理 + HTTPS

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 部署后必做检查

1. 打开前台，确认能显示知识库内容。
2. 注册一个新用户，确认数据库写入正常。
3. 在后台 `/admin.html` 用 `qaq` / `qaq881205` 登录，查看用户列表。
4. 在 AI 对话框提问，确认 DeepSeek 返回结果。

---

## 常见问题

### Q：Render 免费版会休眠吗？
A：会。免费 Web Service 在 15 分钟无请求后会休眠，首次访问需等待 10-30 秒唤醒。建议绑定信用卡升级 Starter 计划（$7/月）避免休眠。

### Q：数据库数据会丢失吗？
A：只要按本文配置了 Render Disk 或 Railway Volume，数据会持久化。未配置持久化的情况下，实例重启后数据会丢失。

### Q：如何修改管理员账号？
A：修改 `db.js` 中的初始化代码，重新部署即可。

---

## 部署文件清单

- `server.js` — 服务入口
- `package.json` — 依赖与启动脚本
- `Dockerfile` — Docker 镜像构建
- `render.yaml` — Render Blueprint 配置
- `railway.json` — Railway 部署配置
- `Procfile` — Heroku/Railway 进程配置
- `.env.example` — 环境变量模板
- `.gitignore` — 排除敏感文件和依赖目录

需要进一步协助（如编写自动化部署脚本、域名配置、HTTPS 证书）请告诉我。
