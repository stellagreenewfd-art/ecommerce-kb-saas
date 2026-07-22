const express = require('express');
const db = require('../db');
const router = express.Router();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const USE_POINTS_LOCAL = 10;
const TRIAL_DURATION_SECONDS = 24 * 60 * 60;

const SYSTEM_PROMPT = `你是一位资深中国电商运营专家，熟悉淘宝/天猫、拼多多、京东、抖音、小红书等平台的运营规则、算法机制、广告投放、直播带货、大促节奏、私域运营、岗位职责、供应链与售后客服。回答时请：
1. 直接给出可落地的策略、步骤、数据或公式；
2. 尽量分点、分阶段，必要时使用表格；
3. 保持简洁专业，不夸大，不编造数据；
4. 遇到需要用户补充信息的问题，给出追问清单。`;

// 记录提问一次
async function recordQuestion(userId) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const log = await db.prepare('SELECT id FROM usage_logs WHERE user_id = ? AND ended_at > ? ORDER BY id DESC LIMIT 1').get(userId, now);
    if (log) {
      await db.prepare('UPDATE usage_logs SET question_count = question_count + 1 WHERE id = ?').run(log.id);
    }
  } catch (e) {
    console.error('record question error', e);
  }
}

// 保存对话到 chat_history
async function saveChat(userId, userMessage, aiResponse, source) {
  try {
    const now = Math.floor(Date.now() / 1000);
    await db.prepare(
      'INSERT INTO chat_history (user_id, user_message, ai_response, source, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, userMessage, aiResponse, source, now);
  } catch (e) {
    console.error('save chat error:', e);
  }
}

router.post('/chat', async (req, res) => {
  try {
    const { userId } = req.user;
    const { message, history = [] } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.json({ ok: false, message: '请填写问题' });
    }

    const user = await db.prepare(
      'SELECT free_uses_left, trial_end_at, points, membership_type, membership_expires_at FROM users WHERE id = ?'
    ).get(userId);
    if (!user) return res.json({ ok: false, message: '用户不存在' });

    const now = Math.floor(Date.now() / 1000);
    const membershipValid = user.membership_expires_at > now && user.membership_type !== 'none';
    const trialActive = user.trial_end_at > now && user.free_uses_left >= 0;
    let source = 'none';

    if (membershipValid) {
      source = 'membership';
    } else if (trialActive) {
      source = 'trial';
    } else if (user.points >= USE_POINTS_LOCAL) {
      await db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(USE_POINTS_LOCAL, userId);
      const trialEnd = now + TRIAL_DURATION_SECONDS;
      await db.prepare('INSERT INTO usage_logs (user_id, source, cost_points, started_at, ended_at) VALUES (?, ?, ?, ?, ?)').run(userId, 'points', USE_POINTS_LOCAL, now, trialEnd);
      source = 'points';
    } else if (user.free_uses_left > 0) {
      const trialEnd = now + TRIAL_DURATION_SECONDS;
      await db.prepare('UPDATE users SET trial_end_at = ?, free_uses_left = free_uses_left - 1 WHERE id = ?').run(trialEnd, userId);
      await db.prepare('INSERT INTO usage_logs (user_id, source, cost_points, started_at, ended_at) VALUES (?, ?, ?, ?, ?)').run(userId, 'free', 0, now, trialEnd);
      source = 'trial';
    } else {
      return res.json({
        ok: false, code: 'NO_ACCESS', canUse: false,
        message: '免费次数已用完且积分不足，请购买积分或会员',
        points: user.points, needPoints: USE_POINTS_LOCAL
      });
    }

    if (!DEEPSEEK_API_KEY) {
      // 无 API Key 时返回模拟响应
      const mockAnswer = `您好！我是电商运营AI助手。您咨询的是关于"${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"的问题。\n\n目前AI服务暂未配置DeepSeek API Key，以下是我的初步建议：\n\n1. 针对此问题，建议先从平台规则和政策入手，了解最新的运营要求\n2. 参考同类目头部商家的操作策略\n3. 结合自身店铺数据做A/B测试\n\n如需完整AI分析，请联系管理员配置API Key。`;
      await saveChat(userId, message, mockAnswer, source);
      await recordQuestion(userId);
      return res.json({ ok: true, answer: mockAnswer, source, mock: true });
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-6),
      { role: 'user', content: message }
    ];

    const response = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek API error:', response.status, errText);
      return res.json({ ok: false, message: `AI 服务暂时不可用 (${response.status})`, detail: errText });
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || '';

    // 保存对话记录
    await saveChat(userId, message, answer, source);
    await recordQuestion(userId);

    res.json({ ok: true, answer, source });
  } catch (e) {
    console.error('AI chat error:', e);
    res.json({ ok: false, message: 'AI 对话失败，请稍后重试' });
  }
});

// 获取当前用户的对话历史
router.get('/history', async (req, res) => {
  try {
    const { userId } = req.user;
    const { limit = 20 } = req.query;
    const records = await db.prepare(
      'SELECT id, user_message, ai_response, source, created_at FROM chat_history WHERE user_id = ? ORDER BY id DESC LIMIT ?'
    ).all(userId, parseInt(limit, 10));
    res.json({ ok: true, records });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, message: '获取失败' });
  }
});

module.exports = router;
