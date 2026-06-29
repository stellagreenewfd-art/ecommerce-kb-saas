const express = require('express');
const db = require('../db');
const router = express.Router();

const USE_POINTS = 10;
const TRIAL_DURATION_SECONDS = 24 * 60 * 60; // 1天

// 检查当前是否可以使用 AI / 网站
router.get('/check', (req, res) => {
  try {
    const { userId } = req.user;
    const user = db.prepare('SELECT free_uses_left, trial_end_at, points, membership_type, membership_expires_at FROM users WHERE id = ?').get(userId);
    if (!user) return res.json({ ok: false, message: '用户不存在' });

    const now = Math.floor(Date.now() / 1000);
    const membershipValid = user.membership_expires_at > now && user.membership_type !== 'none';
    const trialActive = user.trial_end_at > now && user.free_uses_left > 0;

    // 如果会员有效:直接可用
    if (membershipValid) {
      return res.json({ ok: true, canUse: true, source: 'membership', expiresAt: user.membership_expires_at });
    }

    // 如果试用进行中:直接可用
    if (trialActive) {
      return res.json({ ok: true, canUse: true, source: 'trial', trialEndAt: user.trial_end_at, freeUsesLeft: user.free_uses_left });
    }

    // 否则需要积分
    if (user.points >= USE_POINTS) {
      return res.json({ ok: true, canUse: true, source: 'points', points: user.points, needPoints: USE_POINTS });
    }

    // 不能用了
    return res.json({
      ok: true,
      canUse: false,
      source: 'none',
      points: user.points,
      needPoints: USE_POINTS,
      freeUsesLeft: user.free_uses_left,
      message: '免费次数已用完且积分不足,请购买积分或会员'
    });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, message: '检查失败' });
  }
});

// 开始一次使用 (消耗一次免费或开启一次试用/扣积分)
router.post('/start', (req, res) => {
  try {
    const { userId } = req.user;
    const user = db.prepare('SELECT free_uses_left, trial_end_at, points, membership_type, membership_expires_at FROM users WHERE id = ?').get(userId);
    if (!user) return res.json({ ok: false, message: '用户不存在' });

    const now = Math.floor(Date.now() / 1000);
    const membershipValid = user.membership_expires_at > now && user.membership_type !== 'none';

    // 会员有效:不扣任何费用,只记录使用
    if (membershipValid) {
      db.prepare('INSERT INTO usage_logs (user_id, source, cost_points, started_at) VALUES (?, ?, ?, ?)').run(userId, 'membership', 0, now);
      return res.json({ ok: true, source: 'membership', remaining: 'unlimited' });
    }

    // 如果有正在进行的试用:直接继续
    if (user.trial_end_at > now && user.free_uses_left > 0) {
      return res.json({ ok: true, source: 'trial', trialEndAt: user.trial_end_at, freeUsesLeft: user.free_uses_left });
    }

    // 免费次数还有:开始一次新的试用
    if (user.free_uses_left > 0) {
      const trialEnd = now + TRIAL_DURATION_SECONDS;
      db.prepare('UPDATE users SET trial_end_at = ?, free_uses_left = free_uses_left - 1 WHERE id = ?').run(trialEnd, userId);
      db.prepare('INSERT INTO usage_logs (user_id, source, cost_points, started_at, ended_at) VALUES (?, ?, ?, ?, ?)').run(userId, 'free', 0, now, trialEnd);
      return res.json({ ok: true, source: 'trial', trialEndAt: trialEnd, freeUsesLeft: user.free_uses_left - 1 });
    }

    // 扣积分
    if (user.points >= USE_POINTS) {
      db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(USE_POINTS, userId);
      const trialEnd = now + TRIAL_DURATION_SECONDS;
      db.prepare('INSERT INTO usage_logs (user_id, source, cost_points, started_at, ended_at) VALUES (?, ?, ?, ?, ?)').run(userId, 'points', USE_POINTS, now, trialEnd);
      return res.json({ ok: true, source: 'points', consumed: USE_POINTS, remaining: user.points - USE_POINTS, trialEndAt: trialEnd });
    }

    return res.json({ ok: false, message: '积分不足或免费次数已用完' });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, message: '开始失败' });
  }
});

// 记录一次提问 (用于统计,非必须)
router.post('/question', (req, res) => {
  try {
    const { userId } = req.user;
    // 找到最近 24 小时内未结束的 usage_log 并更新 question_count
    const now = Math.floor(Date.now() / 1000);
    const log = db.prepare('SELECT id FROM usage_logs WHERE user_id = ? AND ended_at > ? ORDER BY id DESC LIMIT 1').get(userId, now);
    if (log) {
      db.prepare('UPDATE usage_logs SET question_count = question_count + 1 WHERE id = ?').run(log.id);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, message: '记录失败' });
  }
});

module.exports = { router, USE_POINTS };
