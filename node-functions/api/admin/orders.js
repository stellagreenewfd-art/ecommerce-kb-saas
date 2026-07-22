const { query, initDb } = require('../../_lib/db');
const { verifyAdmin, ok, fail, handleOptions } = require('../../_lib/auth');

let dbReady = false;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (!dbReady) { await initDb(); dbReady = true; }
  const admin = await verifyAdmin(req);
  if (!admin) return fail(res, '未授权', 401);

  const orders = await query(
    'SELECT o.*, u.username, u.phone, u.email FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.id DESC'
  );
  ok(res, { orders: orders.rows });
};
