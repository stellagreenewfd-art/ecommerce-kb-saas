const { query, initDb } = require('../../_lib/db');
const { verifyToken, ok, fail, parseBody, handleOptions } = require('../../_lib/auth');
let dbReady = false;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (!dbReady) { await initDb(); dbReady = true; }

  const user = verifyToken(req);
  if (!user) return fail(res, '未登录', 401);

  const body = await parseBody(req);
  const { orderId } = body;
  if (!orderId) return fail(res, '缺少订单ID');

  const or = await query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [parseInt(orderId), user.userId]);
  if (!or.rows.length) return fail(res, '订单不存在');

  const order = or.rows[0];
  if (order.status === 'paid') return fail(res, '订单已支付');

  const now = Math.floor(Date.now() / 1000);
  await query("UPDATE orders SET status = 'paid', paid_at = $1, pay_method = 'mock' WHERE id = $2", [now, order.id]);

  // 更新用户权益
  if (order.order_type === 'month') {
    const expires = now + 30 * 24 * 60 * 60;
    await query('UPDATE users SET membership_type = $1, membership_expires_at = $2, total_spent = total_spent + $3 WHERE id = $4',
      ['month', expires, order.amount, user.userId]);
  } else if (order.order_type === 'year') {
    const expires = now + 365 * 24 * 60 * 60;
    await query('UPDATE users SET membership_type = $1, membership_expires_at = $2, total_spent = total_spent + $3 WHERE id = $4',
      ['year', expires, order.amount, user.userId]);
  } else if (order.order_type === 'points') {
    await query('UPDATE users SET points = points + $1, total_spent = total_spent + $2 WHERE id = $3',
      [order.points, order.amount, user.userId]);
  }

  ok(res, { message: '支付成功' });
};
