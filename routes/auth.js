const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, verifyToken } = require('../middleware/auth');
const router = express.Router();

// 注册
router.post('/register', (req, res) => {
  try {
    const { phone, email, password, company, role } = req.body || {};
    if (!password || password.length < 6) {
      return res.json({ ok: false, message: '密码至少6位' });
    }
    if (!phone && !email) {
      return res.json({ ok: false, message: '请填写手机号或邮箱' });
    }

    const phoneClean = phone ? phone.trim() : null;
    const emailClean = email ? email.trim().toLowerCase() : null;

    if (phoneClean) {
      const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phoneClean);
      if (existing) return res.json({ ok: false, message: '手机号已注册' });
    }
    if (emailClean) {
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(emailClean);
      if (existing) return res.json({ ok: false, message: '邮箱已注册' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (phone, email, password_hash, company, role, free_uses_left, trial_end_at)
      VALUES (?, ?, ?, ?, ?, 3, 0)
    `).run(phoneClean, emailClean, hash, company || '', role || '');

    const userId = result.lastInsertRowid;
    const user = db.prepare('SELECT id, phone, email, company, role, free_uses_left, points, membership_type, membership_expires_at FROM users WHERE id = ?').get(userId);
    const token = signToken({ userId: user.id });

    res.json({ ok: true, token, user });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, message: '注册失败' });
  }
});

// 登录
router.post('/login', (req, res) => {
  try {
    const { account, password } = req.body || {};
    if (!account || !password) return res.json({ ok: false, message: '请填写账号和密码' });

    const clean = account.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE phone = ? OR email = ?').get(clean, clean);
    if (!user) return res.json({ ok: false, message: '账号不存在' });

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.json({ ok: false, message: '密码错误' });
    }

    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(Math.floor(Date.now()/1000), user.id);

    const token = signToken({ userId: user.id });
    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        company: user.company,
        role: user.role,
        free_uses_left: user.free_uses_left,
        trial_end_at: user.trial_end_at,
        points: user.points,
        membership_type: user.membership_type,
        membership_expires_at: user.membership_expires_at
      }
    });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, message: '登录失败' });
  }
});

// 获取当前用户信息
router.get('/me', verifyToken, (req, res) => {
  try {
    const { userId } = req.user;
    const user = db.prepare('SELECT id, phone, email, company, role, free_uses_left, trial_end_at, points, membership_type, membership_expires_at, created_at FROM users WHERE id = ?').get(userId);
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
