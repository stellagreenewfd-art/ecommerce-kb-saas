const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { verifyAdmin, adminSignToken } = require('../middleware/auth');
const router = express.Router();

// 管理员登录 (公开)
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      return res.json({ ok: false, message: '账号或密码错误' });
    }
    const token = adminSignToken({ adminId: admin.id, username: admin.username });
    res.json({ ok: true, token });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, message: '登录失败' });
  }
});

// 以下接口需管理员登录
router.use(verifyAdmin);

// 用户列表 (支持分页和搜索)
router.get('/users', (req, res) => {
  try {
    const { keyword = '', page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const like = `%${keyword}%`;
    const users = db.prepare(`
      SELECT id, phone, email, company, role, free_uses_left, trial_end_at, points,
             membership_type, membership_expires_at, total_spent, created_at, last_login_at
      FROM users
      WHERE phone LIKE ? OR email LIKE ? OR company LIKE ? OR role LIKE ?
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).all(like, like, like, like, parseInt(limit, 10), offset);

    const total = db.prepare(`
      SELECT COUNT(*) as c FROM users
      WHERE phone LIKE ? OR email LIKE ? OR company LIKE ? OR role LIKE ?
    `).get(like, like, like, like).c;

    res.json({ ok: true, users, total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, message: '获取失败' });
  }
});

// 使用记录
router.get('/usage', (req, res) => {
  try {
    const { userId = '', page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    let sql = 'SELECT * FROM usage_logs ORDER BY id DESC LIMIT ? OFFSET ?';
    let params = [parseInt(limit, 10), offset];
    if (userId) {
      sql = 'SELECT * FROM usage_logs WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?';
      params = [parseInt(userId, 10), parseInt(limit, 10), offset];
    }
    const logs = db.prepare(sql).all(...params);
    res.json({ ok: true, logs });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, message: '获取失败' });
  }
});

// 订单记录
router.get('/orders', (req, res) => {
  try {
    const orders = db.prepare('SELECT o.*, u.phone, u.email FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.id DESC').all();
    res.json({ ok: true, orders });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, message: '获取失败' });
  }
});

// 仪表盘数据
router.get('/dashboard', (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const paidUsers = db.prepare('SELECT COUNT(DISTINCT user_id) as c FROM orders WHERE status = "paid"').get().c;
    const totalRevenue = db.prepare('SELECT SUM(amount) as s FROM orders WHERE status = "paid"').get().s || 0;
    const totalUsage = db.prepare('SELECT COUNT(*) as c FROM usage_logs').get().c;
    const todayStart = Math.floor(new Date().setHours(0,0,0,0) / 1000);
    const todayUsers = db.prepare('SELECT COUNT(*) as c FROM users WHERE created_at >= ?').get(todayStart).c;

    res.json({
      ok: true,
      stats: { totalUsers, paidUsers, totalRevenue, totalUsage, todayUsers }
    });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, message: '获取失败' });
  }
});

module.exports = router;
