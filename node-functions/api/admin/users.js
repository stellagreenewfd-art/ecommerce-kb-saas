const { query, initDb } = require('../../_lib/db');
const { verifyAdmin, ok, fail, handleOptions } = require('../../_lib/auth');

let dbReady = false;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (!dbReady) { await initDb(); dbReady = true; }

  const admin = await verifyAdmin(req);
  if (!admin) return fail(res, '未授权', 401);

  const url = new URL(req.url, `http://${req.headers.host}`);
  const keyword = url.searchParams.get('keyword') || '';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;
  const like = `%${keyword}%`;

  const users = await query(
    `SELECT id,username,phone,email,company,category,role,free_uses_left,trial_end_at,points,
            membership_type,membership_expires_at,total_spent,created_at,last_login_at
     FROM users
     WHERE username LIKE $1 OR phone LIKE $2 OR email LIKE $3 OR company LIKE $4 OR category LIKE $5
     ORDER BY id DESC LIMIT $6 OFFSET $7`,
    [like, like, like, like, like, limit, offset]
  );

  // Add chat count
  const usersWithStats = await Promise.all(users.rows.map(async (u) => {
    const cr = await query('SELECT COUNT(*) as c FROM chat_history WHERE user_id = $1', [u.id]);
    return { ...u, chat_count: parseInt(cr.rows[0].c) };
  }));

  const tr = await query(
    `SELECT COUNT(*) as c FROM users WHERE username LIKE $1 OR phone LIKE $2 OR email LIKE $3 OR company LIKE $4 OR category LIKE $5`,
    [like, like, like, like, like]
  );

  ok(res, { users: usersWithStats, total: parseInt(tr.rows[0].c), page, limit });
};
