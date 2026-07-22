const db = require('../db');
const router = require('express').Router();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const USE_POINTS = 10;
const TRIAL_DURATION = 24 * 60 * 60;

const SYSTEM_PROMPT = `你是一位资深中国电商运营专家，熟悉淘宝/天猫、拼多多、京东、抖音、小红书等平台的运营规则。回答时请：1.直接给出可落地的策略、步骤、数据或公式；2.尽量分点、分阶段，必要时使用表格；3.保持简洁专业。`;

router.post('/chat', async (req, res) => {
  try {
    const { userId } = req.user;
    const { message, history = [] } = req.body || {};
    if (!message) return res.json({ ok: false, message: '请填写问题' });

    const data = db.readDb();
    const u = data.users.find(u => u.id === userId);
    if (!u) return res.json({ ok: false, message: '用户不存在' });

    const now = Math.floor(Date.now() / 1000);
    const member = u.membership_expires_at > now && u.membership_type !== 'none';
    const trial = u.trial_end_at > now && u.free_uses_left >= 0;
    let source = 'none';

    if (member) { source = 'membership'; }
    else if (trial) { source = 'trial'; }
    else if (u.points >= USE_POINTS) {
      u.points -= USE_POINTS;
      const end = now + TRIAL_DURATION;
      data.usage_logs.push({ id: data._seq.usage_logs++, user_id: userId, source: 'points', cost_points: USE_POINTS, started_at: now, ended_at: end, duration_minutes: 0, question_count: 0 });
      source = 'points';
    } else if (u.free_uses_left > 0) {
      const end = now + TRIAL_DURATION;
      u.trial_end_at = end;
      u.free_uses_left -= 1;
      data.usage_logs.push({ id: data._seq.usage_logs++, user_id: userId, source: 'free', cost_points: 0, started_at: now, ended_at: end, duration_minutes: 0, question_count: 0 });
      source = 'trial';
    } else {
      return res.json({ ok: false, code: 'NO_ACCESS', canUse: false, message: '免费次数已用完且积分不足', points: u.points, needPoints: USE_POINTS });
    }

    let answer = '';
    if (DEEPSEEK_API_KEY) {
      try {
        const msgs = [{ role: 'system', content: SYSTEM_PROMPT }, ...history.slice(-6), { role: 'user', content: message }];
        const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
          body: JSON.stringify({ model: 'deepseek-chat', messages: msgs, temperature: 0.7, max_tokens: 2000 })
        });
        if (resp.ok) {
          const d = await resp.json();
          answer = d.choices?.[0]?.message?.content || 'AI 回答为空';
        } else {
          answer = `AI 服务暂时不可用，请稍后重试。\n\n关于您的问题"${message.substring(0, 50)}..."，建议参考知识库中的相关运营策略。`;
        }
      } catch (e) {
        answer = `AI 服务连接失败。\n\n关于"${message.substring(0, 50)}..."，请参考知识库中的内容或联系管理员。`;
      }
    } else {
      answer = `您好！关于"${message.substring(0, 50)}..."的问题，AI服务暂未配置 API Key。\n\n请参考知识库中的详细运营策略，或联系管理员配置 DeepSeek API。`;
    }

    // 保存对话
    data.chat_history.push({
      id: data._seq.chat_history++,
      user_id: userId,
      user_message: message,
      ai_response: answer,
      source,
      created_at: now
    });

    // 更新提问计数
    const log = data.usage_logs.filter(l => l.user_id === userId && l.ended_at > now).sort((a, b) => b.id - a.id)[0];
    if (log) log.question_count = (log.question_count || 0) + 1;

    db.writeDb(data);
    res.json({ ok: true, answer, source });

  } catch (e) {
    console.error('AI error:', e);
    res.json({ ok: false, message: 'AI 对话失败' });
  }
});

// 当前用户聊天记录
router.get('/history', async (req, res) => {
  const data = db.readDb();
  const records = data.chat_history
    .filter(c => c.user_id === req.user.userId)
    .sort((a, b) => b.id - a.id)
    .slice(0, parseInt(req.query.limit) || 20);
  res.json({ ok: true, records });
});

module.exports = router;
