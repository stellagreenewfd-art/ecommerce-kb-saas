const bcrypt = require('bcryptjs');
const db = require('../db');
const { verifyAdmin, adminSignToken } = require('../middleware/auth');

const router = require('express').Router();

// 管理员登录
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const data = db.readDb();
  const admin = data.admins.find(a => a.username === username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.json({ ok: false, message: '账号或密码错误' });
  }
  const token = adminSignToken({ adminId: admin.id, username: admin.username });
  res.json({ ok: true, token });
});

// 以下需管理员权限
router.use(verifyAdmin);

// 用户列表
router.get('/users', async (req, res) => {
  const data = db.readDb();
  const { keyword = '', page = 1, limit = 50 } = req.query;
  const kw = keyword.toLowerCase();
  let users = [...data.users];

  if (kw) {
    users = users.filter(u =>
      (u.username || '').toLowerCase().includes(kw) ||
      (u.phone || '').includes(kw) ||
      (u.email || '').toLowerCase().includes(kw) ||
      (u.company || '').toLowerCase().includes(kw) ||
      (u.category || '').toLowerCase().includes(kw)
    );
  }

  users.sort((a, b) => b.id - a.id);
  const total = users.length;
  const p = parseInt(page);
  const l = parseInt(limit);
  const paged = users.slice((p - 1) * l, p * l);

  const withChatCount = paged.map(u => ({
    ...u, password_hash: undefined,
    chat_count: data.chat_history.filter(c => c.user_id === u.id).length
  }));

  res.json({ ok: true, users: withChatCount, total, page: p, limit: l });
});

// 聊天记录
router.get('/chat-history', async (req, res) => {
  const data = db.readDb();
  const { userId = '', page = 1, limit = 50 } = req.query;
  let chats = [...data.chat_history];

  if (userId) {
    chats = chats.filter(c => c.user_id === parseInt(userId));
  }

  chats.sort((a, b) => b.id - a.id);
  const total = chats.length;
  const p = parseInt(page);
  const l = parseInt(limit);
  const paged = chats.slice((p - 1) * l, p * l);

  const withUser = paged.map(c => {
    const u = data.users.find(u => u.id === c.user_id);
    return { ...c, username: u?.username || '', phone: u?.phone || '', company: u?.company || '', category: u?.category || '' };
  });

  res.json({ ok: true, records: withUser, total, page: p, limit: l });
});

// 仪表盘
router.get('/dashboard', async (req, res) => {
  const data = db.readDb();
  const today = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);

  res.json({
    ok: true,
    stats: {
      totalUsers: data.users.length,
      paidUsers: data.orders.filter(o => o.status === 'paid').length,
      totalRevenue: data.orders.filter(o => o.status === 'paid').reduce((s, o) => s + o.amount, 0),
      totalChats: data.chat_history.length,
      todayUsers: data.users.filter(u => u.created_at >= today).length,
      todayChats: data.chat_history.filter(c => c.created_at >= today).length
    }
  });
});

// 订单
router.get('/orders', async (req, res) => {
  const data = db.readDb();
  const orders = [...data.orders].sort((a, b) => b.id - a.id).map(o => {
    const u = data.users.find(u => u.id === o.user_id);
    return { ...o, username: u?.username || '', phone: u?.phone || '', email: u?.email || '' };
  });
  res.json({ ok: true, orders });
});

// 使用记录
router.get('/usage', async (req, res) => {
  const data = db.readDb();
  const { userId = '' } = req.query;
  let logs = [...data.usage_logs];
  if (userId) logs = logs.filter(l => l.user_id === parseInt(userId));
  logs.sort((a, b) => b.id - a.id);
  const withUser = logs.map(l => {
    const u = data.users.find(u => u.id === l.user_id);
    return { ...l, username: u?.username || '', phone: u?.phone || '' };
  });
  res.json({ ok: true, logs: withUser });
});

module.exports = router;
