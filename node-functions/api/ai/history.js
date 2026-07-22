const { query, initDb } = require('../../_lib/db');
const { verifyToken, ok, fail, handleOptions } = require('../../_lib/auth');

let dbReady = false;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (!dbReady) { await initDb(); dbReady = true; }

  const user = verifyToken(req);
  if (!user) return fail(res, '未登录', 401);

  const url = new URL(req.url, `http://${req.headers.host}`);
  const limit = parseInt(url.searchParams.get('limit') || '20');

  const records = await query(
    'SELECT id, user_message, ai_response, source, created_at FROM chat_history WHERE user_id = $1 ORDER BY id DESC LIMIT $2',
    [user.userId, limit]
  );
  ok(res, { records: records.rows });
};
