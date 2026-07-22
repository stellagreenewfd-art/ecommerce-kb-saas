const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, verifyToken } = require('../middleware/auth');

const router = require('express').Router();

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, phone, password, company, category } = req.body || {};
    if (!username || username.trim().length < 2) return res.json({ ok: false, message: '用户名至少2个字符' });
    if (!phone || phone.trim().length < 11) return res.json({ ok: false, message: '请填写正确的手机号（11位）' });
    if (!password || password.length < 6) return res.json({ ok: false, message: '密码至少6位' });

    const u = username.trim();
    const p = phone.trim();
    if (db.findUserByUsername(u)) return res.json({ ok: false, message: '用户名已被注册' });
    if (db.findUserByPhone(p)) return res.json({ ok: false, message: '手机号已被注册' });

    const hash = bcrypt.hashSync(password, 10);
    const user = db.insertUserNew(db.readDb(), {
      username: u, phone: p, password_hash: hash,
      company: (company || '').trim(), category: (category || '').trim()
    });

    const token = signToken({ userId: user.id });
    const { password_hash, ...safe } = user;
    res.json({ ok: true, token, user: safe });
  } catch (e) {
    console.error('注册失败:', e);
    res.json({ ok: false, message: '注册失败' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { account, password } = req.body || {};
    if (!account || !password) return res.json({ ok: false, message: '请填写账号和密码' });
    const clean = account.trim();

    let user = db.findUserByPhone(clean) || db.findUserByUsername(clean);
    if (!user) return res.json({ ok: false, message: '账号不存在' });
    if (!bcrypt.compareSync(password, user.password_hash)) return res.json({ ok: false, message: '密码错误' });

    const data = db.readDb();
    const u = data.users.find(u => u.id === user.id);
    if (u) { u.last_login_at = Math.floor(Date.now() / 1000); db.writeDb(data); }

    const token = signToken({ userId: user.id });
    const { password_hash, ...safe } = user;
    res.json({ ok: true, token, user: safe });
  } catch (e) {
    console.error('登录失败:', e);
    res.json({ ok: false, message: '登录失败' });
  }
});

// 获取当前用户
router.get('/me', verifyToken, async (req, res) => {
  try {
    const data = db.readDb();
    const u = data.users.find(u => u.id === req.user.userId);
    if (!u) return res.status(404).json({ ok: false, message: '用户不存在' });
    const now = Math.floor(Date.now() / 1000);
    const { password_hash, ...safe } = u;
    safe.membershipValid = u.membership_expires_at > now && u.membership_type !== 'none';
    safe.trialValid = u.trial_end_at > now && u.free_uses_left > 0;
    res.json({ ok: true, user: safe });
  } catch (e) {
    res.json({ ok: false, message: '获取失败' });
  }
});

module.exports = router;
