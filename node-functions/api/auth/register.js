const bcrypt = require('bcryptjs');
const { query, initDb } = require('../../_lib/db');
const { signToken, ok, fail, parseBody, handleOptions } = require('../../_lib/auth');

let dbReady = false;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (!dbReady) { await initDb(); dbReady = true; }

  const body = await parseBody(req);
  const { username, phone, password, company, category } = body;

  if (!username || username.trim().length < 2) return fail(res, '用户名至少2个字符');
  if (!phone || phone.trim().length < 11) return fail(res, '请填写正确的手机号（11位）');
  if (!password || password.length < 6) return fail(res, '密码至少6位');

  const u = username.trim();
  const p = phone.trim();
  const c = (company || '').trim();
  const cat = (category || '').trim();

  const eu = await query('SELECT id FROM users WHERE username = $1', [u]);
  if (eu.rows.length) return fail(res, '用户名已被注册');
  const ep = await query('SELECT id FROM users WHERE phone = $1', [p]);
  if (ep.rows.length) return fail(res, '手机号已被注册');

  const hash = bcrypt.hashSync(password, 10);
  const ir = await query(
    `INSERT INTO users (username, phone, password_hash, company, category, role, free_uses_left, trial_end_at)
     VALUES ($1,$2,$3,$4,$5,$6,3,0) RETURNING id`,
    [u, p, hash, c, cat, cat]
  );
  const userId = ir.rows[0].id;
  const ur = await query(
    'SELECT id,username,phone,email,company,category,role,free_uses_left,points,membership_type,membership_expires_at,created_at FROM users WHERE id=$1',
    [userId]
  );
  const user = ur.rows[0];
  const token = signToken({ userId: user.id });
  ok(res, { token, user });
};
