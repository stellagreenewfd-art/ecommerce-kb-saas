const { query, initDb } = require('../../_lib/db');
const { verifyAdmin, ok, fail, handleOptions } = require('../../_lib/auth');

let dbReady = false;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (!dbReady) { await initDb(); dbReady = true; }
  const admin = await verifyAdmin(req);
  if (!admin) return fail(res, '未授权', 401);

  const tr = await query('SELECT COUNT(*) as c FROM users');
  const pr = await query("SELECT COUNT(DISTINCT user_id) as c FROM orders WHERE status = 'paid'");
  const rr = await query("SELECT SUM(amount) as s FROM orders WHERE status = 'paid'");
  const cr = await query('SELECT COUNT(*) as c FROM chat_history');
  const today = Math.floor(new Date().setHours(0,0,0,0) / 1000);
  const tdr = await query('SELECT COUNT(*) as c FROM users WHERE created_at >= $1', [today]);
  const tcr = await query('SELECT COUNT(*) as c FROM chat_history WHERE created_at >= $1', [today]);

  ok(res, { stats: {
    totalUsers: parseInt(tr.rows[0].c), paidUsers: parseInt(pr.rows[0].c),
    totalRevenue: rr.rows[0].s || 0, totalChats: parseInt(cr.rows[0].c),
    todayUsers: parseInt(tdr.rows[0].c), todayChats: parseInt(tcr.rows[0].c)
  }});
};
