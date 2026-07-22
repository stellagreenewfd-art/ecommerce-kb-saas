const { query, initDb } = require('../../_lib/db');
const { verifyToken, ok, fail, handleOptions } = require('../../_lib/auth');

const USE_POINTS = 10;
const TRIAL_DURATION = 24 * 60 * 60;
let dbReady = false;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (!dbReady) { await initDb(); dbReady = true; }
  const user = verifyToken(req);
  if (!user) return fail(res, '未登录', 401);

  const ur = await query('SELECT free_uses_left, trial_end_at, points, membership_type, membership_expires_at FROM users WHERE id=$1', [user.userId]);
  if (!ur.rows.length) return fail(res, '用户不存在');
  const u = ur.rows[0];
  const now = Math.floor(Date.now() / 1000);
  const member = u.membership_expires_at > now && u.membership_type !== 'none';

  if (member) {
    await query('INSERT INTO usage_logs (user_id, source, cost_points, started_at) VALUES ($1,$2,$3,$4)', [user.userId, 'membership', 0, now]);
    return ok(res, { source: 'membership', remaining: 'unlimited' });
  }
  if (u.trial_end_at > now && u.free_uses_left > 0) {
    return ok(res, { source: 'trial', trialEndAt: u.trial_end_at, freeUsesLeft: u.free_uses_left });
  }
  if (u.free_uses_left > 0) {
    const end = now + TRIAL_DURATION;
    await query('UPDATE users SET trial_end_at=$1, free_uses_left=free_uses_left-1 WHERE id=$2', [end, user.userId]);
    await query('INSERT INTO usage_logs (user_id, source, cost_points, started_at, ended_at) VALUES ($1,$2,$3,$4,$5)', [user.userId, 'free', 0, now, end]);
    return ok(res, { source: 'trial', trialEndAt: end, freeUsesLeft: u.free_uses_left - 1 });
  }
  if (u.points >= USE_POINTS) {
    await query('UPDATE users SET points = points - $1 WHERE id = $2', [USE_POINTS, user.userId]);
    const end = now + TRIAL_DURATION;
    await query('INSERT INTO usage_logs (user_id, source, cost_points, started_at, ended_at) VALUES ($1,$2,$3,$4,$5)', [user.userId, 'points', USE_POINTS, now, end]);
    return ok(res, { source: 'points', consumed: USE_POINTS, remaining: u.points - USE_POINTS, trialEndAt: end });
  }
  fail(res, '积分不足或免费次数已用完');
};
