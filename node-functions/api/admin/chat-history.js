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

  let records, totalR;
  if (userId) {
    records = await query(
      `SELECT ch.*, u.username, u.phone, u.company, u.category
       FROM chat_history ch JOIN users u ON ch.user_id = u.id
       WHERE ch.user_id = $1 ORDER BY ch.id DESC LIMIT $2 OFFSET $3`,
      [parseInt(userId), limit, offset]
    );
    totalR = await query('SELECT COUNT(*) as c FROM chat_history WHERE user_id = $1', [parseInt(userId)]);
  } else {
    records = await query(
      `SELECT ch.*, u.username, u.phone, u.company, u.category
       FROM chat_history ch JOIN users u ON ch.user_id = u.id
       ORDER BY ch.id DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    totalR = await query('SELECT COUNT(*) as c FROM chat_history');
  }

  ok(res, { records: records.rows, total: parseInt(totalR.rows[0].c), page, limit });
};
