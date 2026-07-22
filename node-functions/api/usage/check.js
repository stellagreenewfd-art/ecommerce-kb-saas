const { query, initDb } = require('../../_lib/db');
const { verifyToken, ok, fail, handleOptions } = require('../../_lib/auth');

const USE_POINTS = 10;
let dbReady = false;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (!dbReady) { await initDb(); dbReady = true; }

  const user = verifyToken(req);
  if (!user) return fail(res, '未登录', 401);

  const ur = await query(
    'SELECT free_uses_left, trial_end_at, points, membership_type, membership_expires_at FROM users WHERE id=$1',
    [user.userId]
  );
  if (!ur.rows.length) return fail(res, '用户不存在');
  const u = ur.rows[0];
  const now = Math.floor(Date.now() / 1000);
  const member = u.membership_expires_at > now && u.membership_type !== 'none';
  const trial = u.trial_end_at > now && u.free_uses_left > 0;

  if (member) return ok(res, { canUse: true, source: 'membership', expiresAt: u.membership_expires_at });
  if (trial) return ok(res, { canUse: true, source: 'trial', trialEndAt: u.trial_end_at, freeUsesLeft: u.free_uses_left });
  if (u.points >= USE_POINTS) return ok(res, { canUse: true, source: 'points', points: u.points, needPoints: USE_POINTS });

  ok(res, { canUse: false, source: 'none', points: u.points, needPoints: USE_POINTS, freeUsesLeft: u.free_uses_left, message: '积分不足' });
};
