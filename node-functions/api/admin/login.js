const bcrypt = require('bcryptjs');
const { query, initDb } = require('../../_lib/db');
const { adminSignToken, ok, fail, parseBody, handleOptions } = require('../../_lib/auth');

let dbReady = false;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (!dbReady) { await initDb(); dbReady = true; }

  const body = await parseBody(req);
  const { username, password } = body;
  const r = await query('SELECT * FROM admins WHERE username = $1', [username]);
  if (!r.rows.length || !bcrypt.compareSync(password, r.rows[0].password_hash)) {
    return fail(res, '账号或密码错误');
  }
  const admin = r.rows[0];
  const token = adminSignToken({ adminId: admin.id, username: admin.username });
  ok(res, { token });
};
