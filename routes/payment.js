const express = require('express');
const db = require('../db');
const router = express.Router();

// 定价配置
const PRICING = {
  points: {
    50: 49,
    100: 89,
    200: 169,
    500: 399
  },
  month: 99,
  year: 499
};

// 获取定价
router.get('/pricing', (req, res) => {
  res.json({ ok: true, pricing: PRICING });
});

// 创建订单 (模拟支付,实际应接入微信支付/支付宝)
router.post('/order', (req, res) => {
  try {
    const { userId } = req.user;
    const { type, points } = req.body || {};

    let amount = 0;
    let finalPoints = 0;

    if (type === 'points') {
      const p = parseInt(points, 10);
      if (!PRICING.points[p]) return res.json({ ok: false, message: '积分数量错误' });
      amount = PRICING.points[p];
      finalPoints = p;
    } else if (type === 'month') {
      amount = PRICING.month;
      finalPoints = 0;
    } else if (type === 'year') {
      amount = PRICING.year;
      finalPoints = 0;
    } else {
      return res.json({ ok: false, message: '类型错误' });
    }

    const result = db.prepare(`
      INSERT INTO orders (user_id, order_type, amount, points, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(userId, type, amount, finalPoints);

    res.json({ ok: true, orderId: result.lastInsertRowid, amount, type, points: finalPoints });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, message: '创建订单失败' });
  }
});

// 模拟支付成功回调 (实际应接入支付网关)
router.post('/pay', (req, res) => {
  try {
    const { userId } = req.user;
    const { orderId } = req.body || {};

    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, userId);
    if (!order) return res.json({ ok: false, message: '订单不存在' });
    if (order.status === 'paid') return res.json({ ok: false, message: '订单已支付' });

    const now = Math.floor(Date.now() / 1000);

    if (order.order_type === 'points') {
      db.prepare('UPDATE users SET points = points + ?, total_spent = total_spent + ?, updated_at = ? WHERE id = ?')
        .run(order.points, order.amount, now, userId);
    } else if (order.order_type === 'month') {
      const expire = Math.max(order.membership_expires_at || now, now) + 30 * 24 * 60 * 60;
      db.prepare('UPDATE users SET membership_type = ?, membership_expires_at = ?, total_spent = total_spent + ?, updated_at = ? WHERE id = ?')
        .run('month', expire, order.amount, now, userId);
    } else if (order.order_type === 'year') {
      const expire = Math.max(order.membership_expires_at || now, now) + 365 * 24 * 60 * 60;
      db.prepare('UPDATE users SET membership_type = ?, membership_expires_at = ?, total_spent = total_spent + ?, updated_at = ? WHERE id = ?')
        .run('year', expire, order.amount, now, userId);
    }

    db.prepare('UPDATE orders SET status = ?, paid_at = ? WHERE id = ?').run('paid', now, orderId);

    res.json({ ok: true, message: '支付成功' });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, message: '支付失败' });
  }
});

// 我的订单
router.get('/orders', (req, res) => {
  try {
    const { userId } = req.user;
    const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(userId);
    res.json({ ok: true, orders });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, message: '获取失败' });
  }
});

module.exports = { router, PRICING };
