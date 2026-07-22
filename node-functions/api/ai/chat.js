const { query, initDb } = require('../../_lib/db');
const { verifyToken, ok, fail, parseBody, handleOptions } = require('../../_lib/auth');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const USE_POINTS = 10;
const TRIAL_DURATION = 24 * 60 * 60;

const SYSTEM_PROMPT = `你是一位资深中国电商运营专家，熟悉淘宝/天猫、拼多多、京东、抖音、小红书等平台的运营规则、算法机制、广告投放、直播带货、大促节奏、私域运营、岗位职责、供应链与售后客服。回答时请：
1. 直接给出可落地的策略、步骤、数据或公式；
2. 尽量分点、分阶段，必要时使用表格；
3. 保持简洁专业，不夸大，不编造数据；
4. 遇到需要用户补充信息的问题，给出追问清单。`;

let dbReady = false;

async function saveChat(userId, userMessage, aiResponse, source) {
  const now = Math.floor(Date.now() / 1000);
  await query(
    'INSERT INTO chat_history (user_id, user_message, ai_response, source, created_at) VALUES ($1,$2,$3,$4,$5)',
    [userId, userMessage, aiResponse, source, now]
  );
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (!dbReady) { await initDb(); dbReady = true; }

  const user = verifyToken(req);
  if (!user) return fail(res, '未登录', 401);

  const body = await parseBody(req);
  const { message, history = [] } = body;
  if (!message || typeof message !== 'string') return fail(res, '请填写问题');

  const userId = user.userId;
  const ur = await query(
    'SELECT free_uses_left, trial_end_at, points, membership_type, membership_expires_at FROM users WHERE id=$1',
    [userId]
  );
  if (!ur.rows.length) return fail(res, '用户不存在');
  const u = ur.rows[0];
  const now = Math.floor(Date.now() / 1000);
  const member = u.membership_expires_at > now && u.membership_type !== 'none';
  const trial = u.trial_end_at > now && u.free_uses_left >= 0;
  let source = 'none';

  if (member) { source = 'membership'; }
  else if (trial) { source = 'trial'; }
  else if (u.points >= USE_POINTS) {
    await query('UPDATE users SET points = points - $1 WHERE id = $2', [USE_POINTS, userId]);
    const end = now + TRIAL_DURATION;
    await query('INSERT INTO usage_logs (user_id, source, cost_points, started_at, ended_at) VALUES ($1,$2,$3,$4,$5)',
      [userId, 'points', USE_POINTS, now, end]);
    source = 'points';
  } else if (u.free_uses_left > 0) {
    const end = now + TRIAL_DURATION;
    await query('UPDATE users SET trial_end_at=$1, free_uses_left=free_uses_left-1 WHERE id=$2', [end, userId]);
    await query('INSERT INTO usage_logs (user_id, source, cost_points, started_at, ended_at) VALUES ($1,$2,$3,$4,$5)',
      [userId, 'free', 0, now, end]);
    source = 'trial';
  } else {
    return ok(res, { ok: false, code: 'NO_ACCESS', message: '免费次数已用完且积分不足', points: u.points, needPoints: USE_POINTS });
  }

  // Call DeepSeek
  if (!DEEPSEEK_API_KEY) {
    const mock = `您好！关于"${message.substring(0, 30)}..."的问题，AI服务暂未配置，请联系管理员。`;
    await saveChat(userId, message, mock, source);
    return ok(res, { answer: mock, source, mock: true });
  }

  try {
    const msgs = [{ role: 'system', content: SYSTEM_PROMPT }, ...history.slice(-6), { role: 'user', content: message }];
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: msgs, temperature: 0.7, max_tokens: 2000 })
    });
    if (!resp.ok) { const t = await resp.text(); return fail(res, `AI服务不可用 (${resp.status})`); }
    const data = await resp.json();
    const answer = data.choices?.[0]?.message?.content || '';
    await saveChat(userId, message, answer, source);
    ok(res, { answer, source });
  } catch (e) {
    fail(res, 'AI对话失败');
  }
};
