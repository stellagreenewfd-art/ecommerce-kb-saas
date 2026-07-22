const db = require('../db');
const router = require('express').Router();
const USE_POINTS = 10;
const TRIAL_DURATION = 24 * 60 * 60;

router.get('/check', async (req, res) => {
  const data = db.readDb();
  const u = data.users.find(u => u.id === req.user.userId);
  if (!u) return res.json({ ok: false, message: '用户不存在' });
  const now = Math.floor(Date.now() / 1000);
  const member = u.membership_expires_at > now && u.membership_type !== 'none';
  const trial = u.trial_end_at > now && u.free_uses_left > 0;

  if (member) return res.json({ ok: true, canUse: true, source: 'membership' });
  if (trial) return res.json({ ok: true, canUse: true, source: 'trial' });
  if (u.points >= USE_POINTS) return res.json({ ok: true, canUse: true, source: 'points' });
  res.json({ ok: true, canUse: false, source: 'none', message: '积分不足' });
});

router.post('/start', async (req, res) => {
  const data = db.readDb();
  const u = data.users.find(u => u.id === req.user.userId);
  if (!u) return res.json({ ok: false, message: '用户不存在' });
  const now = Math.floor(Date.now() / 1000);

  if (u.membership_expires_at > now && u.membership_type !== 'none') {
    data.usage_logs.push({ id: data._seq.usage_logs++, user_id: u.id, source: 'membership', cost_points: 0, started_at: now, ended_at: 0 });
    db.writeDb(data);
    return res.json({ ok: true, source: 'membership' });
  }
  if (u.trial_end_at > now && u.free_uses_left > 0) {
    return res.json({ ok: true, source: 'trial' });
  }
  if (u.free_uses_left > 0) {
    const end = now + TRIAL_DURATION;
    u.trial_end_at = end;
    u.free_uses_left -= 1;
    data.usage_logs.push({ id: data._seq.usage_logs++, user_id: u.id, source: 'free', cost_points: 0, started_at: now, ended_at: end });
    db.writeDb(data);
    return res.json({ ok: true, source: 'trial' });
  }
  if (u.points >= USE_POINTS) {
    u.points -= USE_POINTS;
    const end = now + TRIAL_DURATION;
    data.usage_logs.push({ id: data._seq.usage_logs++, user_id: u.id, source: 'points', cost_points: USE_POINTS, started_at: now, ended_at: end });
    db.writeDb(data);
    return res.json({ ok: true, source: 'points' });
  }
  res.json({ ok: false, message: '积分不足' });
});

module.exports = { router, USE_POINTS };
