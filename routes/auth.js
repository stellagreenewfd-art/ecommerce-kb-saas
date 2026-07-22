const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, verifyToken } = require('../middleware/auth');
const router = express.Router();

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, phone, password, company, category } = req.body || {};

    if (!username || username.trim().length < 2) {
      return res.json({ ok: false, message: '用户名至少2个字符' });
    }
    if (!phone || phone.trim().length < 11) {
      return res.json({ ok: false, message: '请填写正确的手机号（11位）' });
    }
    if (!password || password.length < 6) {
      return res.json({ ok: false, message: '密码至少6位' });
    }

    const usernameClean = username.trim();
    const phoneClean = phone.trim();
    const companyClean = (company || '').trim();
    const categoryClean = (category || '').trim();

    // 检查用户名
    const existingUser = await db.prepare('SELECT id FROM users WHERE username = ?').get(usernameClean);
    if (existingUser) return res.json({ ok: false, message: '用户名已被注册' });

    // 检查手机号
    const existingPhone = await db.prepare('SELECT id FROM users WHERE phone = ?').get(phoneClean);
    if (existingPhone) return res.json({ ok: false, message: '手机号已被注册' });

    const hash = bcrypt.hashSync(password, 10);
    const result = await db.prepare(`
      INSERT INTO users (username, phone, password_hash, company, category, role, free_uses_left, trial_end_at)
      VALUES (?, ?, ?, ?, ?, ?, 3, 0)
      RETURNING id
    `).run(usernameClean, phoneClean, hash, companyClean, categoryClean, categoryClean);

    const userId = result.lastInsertRowid;
    const user = await db.prepare(
      'SELECT id, username, phone, email, company, category, role, free_uses_left, points, membership_type, membership_expires_at, created_at FROM users WHERE id = ?'
    ).get(userId);
    const token = signToken({ userId: user.id });

    res.json({ ok: true, token, user });
  } catch (e) {
    console.error('注册失败:', e);
    res.json({ ok: false, message: '注册失败，请稍后重试' });
  }
});

// 登录（支持手机号或用户名）
router.post('/login', async (req, res) => {
  try {
    const { account, password } = req.body || {};
    if (!account || !password) return res.json({ ok: false, message: '请填写账号和密码' });

    const clean = account.trim();
    // 先按手机号查，再按用户名查
    let user = await db.prepare('SELECT * FROM users WHERE phone = ?').get(clean);
    if (!user) {
      user = await db.prepare('SELECT * FROM users WHERE username = ?').get(clean);
    }
    if (!user) {
      // 也尝试邮箱
      user = await db.prepare('SELECT * FROM users WHERE email = ?').get(clean.toLowerCase());
    }
    if (!user) return res.json({ ok: false, message: '账号不存在' });

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.json({ ok: false, message: '密码错误' });
    }

    await db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), user.id);

    const token = signToken({ userId: user.id });
    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        phone: user.phone,
        email: user.email,
        company: user.company,
        category: user.category,
        role: user.role,
        free_uses_left: user.free_uses_left,
        trial_end_at: user.trial_end_at,
        points: user.points,
        membership_type: user.membership_type,
        membership_expires_at: user.membership_expires_at,
        created_at: user.created_at
      }
    });
  } catch (e) {
    console.error('登录失败:', e);
    res.json({ ok: false, message: '登录失败，请稍后重试' });
  }
});

// 获取当前用户信息
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const user = await db.prepare(
      'SELECT id, username, phone, email, company, category, role, free_uses_left, trial_end_at, points, membership_type, membership_expires_at, created_at FROM users WHERE id = ?'
    ).get(userId);
    if (!user) return res.status(404).json({ ok: false, message: '用户不存在' });

    const now = Math.floor(Date.now() / 1000);
    const membershipValid = user.membership_expires_at > now && user.membership_type !== 'none';
    const trialValid = user.trial_end_at > now && user.free_uses_left > 0;

    res.json({
      ok: true,
      user: {
        ...user,
        membershipValid,
        trialValid
      }
    });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, message: '获取失败' });
  }
});

module.exports = router;
