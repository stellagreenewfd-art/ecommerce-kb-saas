const { query, initDb } = require('../../_lib/db');
const { verifyAdmin, ok, fail, handleOptions } = require('../../_lib/auth');

let dbReady = false;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (!dbReady) { await initDb(); dbReady = true; }
  const admin = await verifyAdmin(req);
  if (!admin) return fail(res, '未授权', 401);

  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = url.searchParams.get('userId') || '';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  let logs;
  if (userId) {
    logs = await query(
      'SELECT ul.*, u.username, u.phone FROM usage_logs ul JOIN users u ON ul.user_id = u.id WHERE ul.user_id = $1 ORDER BY ul.id DESC LIMIT $2 OFFSET $3',
      [parseInt(userId), limit, offset]
    );
  } else {
    logs = await query(
      'SELECT ul.*, u.username, u.phone FROM usage_logs ul JOIN users u ON ul.user_id = u.id ORDER BY ul.id DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
  }
  ok(res, { logs: logs.rows });
};
