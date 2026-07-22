const { query, initDb } = require('../../_lib/db');
const { verifyToken, ok, fail, handleOptions } = require('../../_lib/auth');
let dbReady = false;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (!dbReady) { await initDb(); dbReady = true; }
  const user = verifyToken(req);
  if (!user) return fail(res, '未登录', 401);

  const now = Math.floor(Date.now() / 1000);
  const log = await query('SELECT id FROM usage_logs WHERE user_id = $1 AND ended_at > $2 ORDER BY id DESC LIMIT 1', [user.userId, now]);
  if (log.rows.length) {
    await query('UPDATE usage_logs SET question_count = question_count + 1 WHERE id = $1', [log.rows[0].id]);
  }
  ok(res);
};
