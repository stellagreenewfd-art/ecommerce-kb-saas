const { query, initDb } = require('../../_lib/db');
const { verifyToken, ok, fail, parseBody, handleOptions } = require('../../_lib/auth');

const PRICING = { month: 99, year: 499, points: { 50: 49, 100: 89, 200: 159, 500: 349, 1000: 599 } };
let dbReady = false;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (!dbReady) { await initDb(); dbReady = true; }

  const user = verifyToken(req);
  if (!user) return fail(res, '未登录', 401);

  const body = await parseBody(req);
  const { type, points } = body;

  let amount = 0;
  let pts = 0;
  if (type === 'month') { amount = PRICING.month; pts = 0; }
  else if (type === 'year') { amount = PRICING.year; pts = 0; }
  else if (type === 'points' && PRICING.points[points]) { amount = PRICING.points[points]; pts = parseInt(points); }
  else return fail(res, '无效套餐');

  const now = Math.floor(Date.now() / 1000);
  const r = await query(
    'INSERT INTO orders (user_id, order_type, amount, points, status, created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [user.userId, type, amount, pts, 'pending', now]
  );
  ok(res, { orderId: r.rows[0].id, amount, type, points: pts });
};
