const db = require('../db');
const router = require('express').Router();

const PRICING = { month: 99, year: 499, points: { 50: 49, 100: 89, 200: 159, 500: 349, 1000: 599 } };

router.get('/pricing', (req, res) => {
  res.json({ ok: true, pricing: PRICING });
});

router.post('/order', async (req, res) => {
  const data = db.readDb();
  const u = data.users.find(u => u.id === req.user.userId);
  if (!u) return res.json({ ok: false, message: '用户不存在' });

  const { type, points } = req.body || {};
  let amount = 0, pts = 0;
  if (type === 'month') amount = PRICING.month;
  else if (type === 'year') amount = PRICING.year;
  else if (type === 'points' && PRICING.points[points]) { amount = PRICING.points[points]; pts = parseInt(points); }
  else return res.json({ ok: false, message: '无效套餐' });

  const id = data._seq.orders++;
  const order = { id, user_id: u.id, order_type: type, amount, points: pts, status: 'pending', pay_method: null, created_at: Math.floor(Date.now() / 1000), paid_at: 0 };
  data.orders.push(order);
  db.writeDb(data);
  res.json({ ok: true, orderId: id, amount, type, points: pts });
});

router.post('/pay', async (req, res) => {
  const data = db.readDb();
  const { orderId } = req.body || {};
  const order = data.orders.find(o => o.id === parseInt(orderId) && o.user_id === req.user.userId);
  if (!order) return res.json({ ok: false, message: '订单不存在' });
  if (order.status === 'paid') return res.json({ ok: false, message: '已支付' });

  const now = Math.floor(Date.now() / 1000);
  order.status = 'paid';
  order.paid_at = now;
  order.pay_method = 'mock';

  const u = data.users.find(u => u.id === req.user.userId);
  if (u) {
    u.total_spent = (u.total_spent || 0) + order.amount;
    if (order.order_type === 'month') {
      u.membership_type = 'month';
      u.membership_expires_at = now + 30 * 24 * 60 * 60;
    } else if (order.order_type === 'year') {
      u.membership_type = 'year';
      u.membership_expires_at = now + 365 * 24 * 60 * 60;
    } else {
      u.points = (u.points || 0) + order.points;
    }
  }
  db.writeDb(data);
  res.json({ ok: true, message: '支付成功' });
});

module.exports = { router };
