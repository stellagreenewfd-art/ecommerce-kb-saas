const { query, initDb } = require('../../_lib/db');
const { verifyToken, ok, fail, handleOptions } = require('../../_lib/auth');

let dbReady = false;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (!dbReady) { await initDb(); dbReady = true; }

  const user = verifyToken(req);
  if (!user) return fail(res, '未登录', 401);

  const ur = await query(
    'SELECT id,username,phone,email,company,category,role,free_uses_left,trial_end_at,points,membership_type,membership_expires_at,created_at FROM users WHERE id=$1',
    [user.userId]
  );
  if (!ur.rows.length) return fail(res, '用户不存在', 404);

  const u = ur.rows[0];
  const now = Math.floor(Date.now() / 1000);
  ok(res, {
    user: {
      ...u,
      membershipValid: u.membership_expires_at > now && u.membership_type !== 'none',
      trialValid: u.trial_end_at > now && u.free_uses_left > 0
    }
  });
};
