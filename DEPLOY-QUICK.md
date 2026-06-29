# 一键部署到 Render 快速指南

> 目标：把电商知识库 SaaS 部署到公网，生成可分享的链接。

## 方案 A：全自动（推荐有 Token 的用户）

需要准备：
- GitHub 账号
- Render 账号
- GitHub Token: https://github.com/settings/tokens (勾选 `repo` 权限)
- Render API Key: https://dashboard.render.com/u/settings (Account Settings → API Keys)

执行：

```bash
cd /Users/qinaqiang/WorkBuddy/2026-06-13-22-26-14/ecommerce-kb

export GITHUB_TOKEN=你的GitHubToken
export RENDER_API_KEY=你的RenderApiKey

bash deploy-to-render.sh
```

脚本会自动：
1. 初始化 git 仓库
2. 在 GitHub 创建私有仓库
3. 推送代码
4. 在 Render 创建 Web Service
5. 设置环境变量（DEEPSEEK_API_KEY、JWT_SECRET、PORT）
6. 输出公网访问链接

## 方案 B：半自动（最简单，无需 Token）

### 第 1 步：在 GitHub 创建仓库

1. 访问 https://github.com/new
2. 仓库名称填：`ecommerce-kb-saas`
3. 选择 **Private**（私有）
4. 不要勾选 "Initialize this repository with a README"
5. 点击 **Create repository**
6. 复制页面上的仓库地址，例如：
   ```
   https://github.com/你的用户名/ecommerce-kb-saas.git
   ```

### 第 2 步：运行推送脚本

```bash
cd /Users/qinaqiang/WorkBuddy/2026-06-13-22-26-14/ecommerce-kb
bash deploy-to-render.sh
```

按提示输入：
- GitHub 用户名
- 仓库地址（第 1 步复制的）

脚本会推送代码并生成一个 **Deploy to Render** 链接。

### 第 3 步：点击 Render 部署链接

1. 脚本会输出类似：
   ```
   https://render.com/deploy?repo=https://github.com/你的用户名/ecommerce-kb-saas
   ```
2. 点击链接，用 GitHub 登录 Render
3. 页面显示 Blueprint 配置，点击 **Apply**
4. 在 Environment 中填入：
   - `DEEPSEEK_API_KEY` = `sk-ba0219fb9677478081deaf4f6d7931ca`
   - `JWT_SECRET` = 任意 32 位以上随机字符串，例如 `qaq-ecommerce-kb-2026-secret-key`
5. 点击 **Create Web Service**
6. 等待 2-3 分钟，Render 会生成公网链接

## 访问你的 SaaS

部署完成后，你会得到类似：

```
https://ecommerce-kb-saas-xxx.onrender.com
```

- 前台：`https://你的域名/`
- 后台：`https://你的域名/admin.html`
- 管理员：`qaq` / `qaq881205`

## 重要提醒

- `.env` 文件包含真实 API Key，**已用 .gitignore 排除**，不会推送到 GitHub
- 部署时必须在 Render 后台手动填入环境变量
- Render 免费版 15 分钟无访问会休眠，首次加载需 10-30 秒
- 如需稳定商用，建议升级 Render Starter 计划（$7/月）或部署到云服务器

## 遇到问题？

1. 检查 GitHub 仓库是否成功推送
2. 检查 Render 部署日志（Dashboard → 你的服务 → Logs）
3. 确认环境变量 `DEEPSEEK_API_KEY` 和 `JWT_SECRET` 已正确设置
4. 查看 `DEPLOY.md` 完整文档
