require('./env-loader').loadEnv();

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initDb } = require('./db');
const { verifyToken, verifyAdmin } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const usage = require('./routes/usage');
const payment = require('./routes/payment');
const adminRoutes = require('./routes/admin');
const aiRoutes = require('./routes/ai');

const app = express();

// 安全与限速
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/usage', verifyToken, usage.router);
app.use('/api/payment', verifyToken, payment.router);
app.use('/api/ai', verifyToken, aiRoutes);
app.use('/api/admin', adminRoutes);

// 静态文件:前端页面
app.use(express.static(path.join(__dirname, 'public')));

// 兜底:所有非 API 路由返回 index.html (SPA 支持)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ ok: false, message: 'API 不存在' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 本地开发/Render 等直接启动
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  initDb().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  }).catch(err => {
    console.error('Database init failed:', err);
    process.exit(1);
  });
}

module.exports = app;
