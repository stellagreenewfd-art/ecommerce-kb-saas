const bcrypt = require('bcryptjs');
const { query, initDb } = require('../../_lib/db');
const { signToken, json, ok, fail, parseBody, handleOptions } = require('../../_lib/auth');

let dbReady = false;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (!dbReady) { await initDb(); dbReady = true; }

  const body = await parseBody(req);
  const { account, password } = body;
  if (!account || !password) return fail(res, '请填写账号和密码');

  const clean = account.trim();
  let result = await query('SELECT * FROM users WHERE phone = $1', [clean]);
  if (result.rows.length === 0) {
    result = await query('SELECT * FROM users WHERE username = $1', [clean]);
  }
  if (result.rows.length === 0) {
    result = await query('SELECT * FROM users WHERE email = $1', [clean.toLowerCase()]);
  }
  if (result.rows.length === 0) return fail(res, '账号不存在');

  const user = result.rows[0];
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return fail(res, '密码错误');
  }

  const now = Math.floor(Date.now() / 1000);
  await query('UPDATE users SET last_login_at = $1 WHERE id = $2', [now, user.id]);

  const token = signToken({ userId: user.id });
  ok(res, {
    token,
    user: {
      id: user.id, username: user.username, phone: user.phone, email: user.email,
      company: user.company, category: user.category, role: user.role,
      free_uses_left: user.free_uses_left, trial_end_at: user.trial_end_at,
      points: user.points, membership_type: user.membership_type,
      membership_expires_at: user.membership_expires_at, created_at: user.created_at
    }
  });
};
