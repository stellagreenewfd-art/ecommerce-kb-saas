const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { verifyAdmin, adminSignToken } = require('../middleware/auth');
const router = express.Router();

// 管理员登录 (公开)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const admin = await db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
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

// 用户列表 (支持分页和搜索) - 包含 username, company, category, phone
router.get('/users', async (req, res) => {
  try {
    const { keyword = '', page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const like = `%${keyword}%`;
    const users = await db.prepare(`
      SELECT id, username, phone, email, company, category, role,
             free_uses_left, trial_end_at, points,
             membership_type, membership_expires_at, total_spent,
             created_at, last_login_at
      FROM users
      WHERE username LIKE ? OR phone LIKE ? OR email LIKE ? OR company LIKE ? OR category LIKE ?
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).all(like, like, like, like, like, parseInt(limit, 10), offset);

    // 为每个用户统计查询次数
    const usersWithStats = await Promise.all(users.map(async (u) => {
      const chatCount = await db.prepare('SELECT COUNT(*) as c FROM chat_history WHERE user_id = ?').get(u.id);
      return { ...u, chat_count: chatCount ? chatCount.c : 0 };
    }));

    const totalResult = await db.prepare(`
      SELECT COUNT(*) as c FROM users
      WHERE username LIKE ? OR phone LIKE ? OR email LIKE ? OR company LIKE ? OR category LIKE ?
    `).get(like, like, like, like, like);

    res.json({ ok: true, users: usersWithStats, total: totalResult.c, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, message: '获取失败' });
  }
});

// 所有用户查询案例列表（管理员可见）
router.get('/chat-history', async (req, res) => {
  try {
    const { userId = '', page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    let sql, params;
    if (userId) {
      sql = `
        SELECT ch.*, u.username, u.phone, u.company, u.category
        FROM chat_history ch
        JOIN users u ON ch.user_id = u.id
        WHERE ch.user_id = ?
        ORDER BY ch.id DESC
        LIMIT ? OFFSET ?
      `;
      params = [parseInt(userId, 10), parseInt(limit, 10), offset];
    } else {
      sql = `
        SELECT ch.*, u.username, u.phone, u.company, u.category
        FROM chat_history ch
        JOIN users u ON ch.user_id = u.id
        ORDER BY ch.id DESC
        LIMIT ? OFFSET ?
      `;
      params = [parseInt(limit, 10), offset];
    }

    const records = await db.prepare(sql).all(...params);

    const totalSql = userId
      ? 'SELECT COUNT(*) as c FROM chat_history WHERE user_id = ?'
      : 'SELECT COUNT(*) as c FROM chat_history';
    const totalParams = userId ? [parseInt(userId, 10)] : [];
    const totalResult = await db.prepare(totalSql).get(...totalParams);

    res.json({
      ok: true,
      records,
      total: totalResult.c,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });
  } catch (e) {
    console.error('获取聊天记录失败:', e);
    res.json({ ok: false, message: '获取失败' });
  }
});

// 使用记录
router.get('/usage', async (req, res) => {
  try {
    const { userId = '', page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    let sql = 'SELECT ul.*, u.username, u.phone FROM usage_logs ul JOIN users u ON ul.user_id = u.id ORDER BY ul.id DESC LIMIT ? OFFSET ?';
    let params = [parseInt(limit, 10), offset];
    if (userId) {
      sql = 'SELECT ul.*, u.username, u.phone FROM usage_logs ul JOIN users u ON ul.user_id = u.id WHERE ul.user_id = ? ORDER BY ul.id DESC LIMIT ? OFFSET ?';
      params = [parseInt(userId, 10), parseInt(limit, 10), offset];
    }
    const logs = await db.prepare(sql).all(...params);
    res.json({ ok: true, logs });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, message: '获取失败' });
  }
});

// 订单记录
router.get('/orders', async (req, res) => {
  try {
    const orders = await db.prepare(
      'SELECT o.*, u.username, u.phone, u.email FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.id DESC'
    ).all();
    res.json({ ok: true, orders });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, message: '获取失败' });
  }
});

// 仪表盘数据
router.get('/dashboard', async (req, res) => {
  try {
    const totalUsersResult = await db.prepare('SELECT COUNT(*) as c FROM users').get();
    const paidUsersResult = await db.prepare('SELECT COUNT(DISTINCT user_id) as c FROM orders WHERE status = ?').get('paid');
    const totalRevenueResult = await db.prepare('SELECT SUM(amount) as s FROM orders WHERE status = ?').get('paid');
    const totalChatsResult = await db.prepare('SELECT COUNT(*) as c FROM chat_history').get();
    const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
    const todayUsersResult = await db.prepare('SELECT COUNT(*) as c FROM users WHERE created_at >= ?').get(todayStart);
    const todayChatsResult = await db.prepare('SELECT COUNT(*) as c FROM chat_history WHERE created_at >= ?').get(todayStart);

    res.json({
      ok: true,
      stats: {
        totalUsers: totalUsersResult.c,
        paidUsers: paidUsersResult.c,
        totalRevenue: totalRevenueResult.s || 0,
        totalChats: totalChatsResult.c,
        todayUsers: todayUsersResult.c,
        todayChats: todayChatsResult.c
      }
    });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, message: '获取失败' });
  }
});

module.exports = router;
