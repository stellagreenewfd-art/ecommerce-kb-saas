# Vercel + Neon 部署指南（无需信用卡）

本方案将后端数据库从 SQLite 替换为 **Neon Serverless PostgreSQL**，部署到 **Vercel Hobby（免费）**，无需绑定信用卡。

---

## 1. 准备代码

当前代码已经支持 PostgreSQL 和 Vercel Serverless，你只需完成以下账号配置。

---

## 2. 创建 Neon 免费数据库

1. 访问 [https://neon.tech](https://neon.tech)
2. 用 GitHub 或 Google 账号注册（免费 Hobby 计划）
3. 创建一个新 Project，例如 `ecommerce-kb`
4. 进入项目后，复制 **Database URL**，格式类似：
   ```
   postgresql://username:password@host.neon.tech/dbname?sslmode=require
   ```
5. 保存好这个 URL，下一步会用到

---

## 3. 创建 Vercel 项目

### 方式 A：通过 Vercel 官网导入 GitHub 仓库（推荐）

1. 访问 [https://vercel.com/new](https://vercel.com/new)
2. 选择你的 GitHub 仓库 `stellagreenewfd-art/ecommerce-kb-saas`
3. Framework Preset 选择 **Other**
4. 点击 Deploy 前，先添加环境变量（见第 4 步）

### 方式 B：通过 Vercel CLI

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 进入项目目录
cd ecommerce-kb

# 关联并部署
vercel
```

---

## 4. 配置环境变量

在 Vercel Project → Settings → Environment Variables 中添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DATABASE_URL` | `postgresql://...` | Neon 数据库连接串 |
| `DEEPSEEK_API_KEY` | `sk-ba0219fb9677478081deaf4f6d7931ca` | DeepSeek API Key |
| `JWT_SECRET` | 任意随机字符串 | 用于 JWT 签名，生产环境请务必修改 |

> 注意：`JWT_SECRET` 不要使用默认值，请生成一个长随机字符串，例如 `openssl rand -base64 32`。

添加后重新部署：
- 官网：点击 Redeploy
- CLI：`vercel --prod`

---

## 5. 验证部署

部署完成后，Vercel 会提供一个 `.vercel.app` 域名：

- 前台：`https://你的域名/`
- 后台：`https://你的域名/admin.html`
- 管理员账号：`qaq`
- 管理员密码：`qaq881205`

---

## 6. 本地开发

如需本地运行，需要一个本地 PostgreSQL 实例，或临时使用 Neon 数据库：

```bash
# 创建 .env 文件
cp .env.example .env

# 编辑 .env，填入 DATABASE_URL, DEEPSEEK_API_KEY, JWT_SECRET

# 启动
npm run dev
```

---

## 7. 免费额度限制

| 服务 | 免费额度 |
|------|---------|
| Vercel Hobby | 100 GB 带宽/月，10 秒 Serverless Function 超时，项目 12 小时无访问会进入休眠 |
| Neon Free Tier | 500 MB 存储，100 计算小时/月 |

对于个人测试和小规模使用完全足够。

---

## 8. 数据库持久化

与 Render Free 的 `/tmp/app.db` 不同，Neon 的数据是持久化的。即使 Vercel Serverless 实例休眠，用户数据、积分、订单也不会丢失。
