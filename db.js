// 纯文件 JSON 数据库 — 无需 PostgreSQL/Neon，Render 直接跑
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// 默认数据结构
function defaultData() {
  return {
    users: [],
    chat_history: [],
    usage_logs: [],
    orders: [],
    admins: [{ id: 1, username: 'qaq', password_hash: bcrypt.hashSync('qaq881205', 10), created_at: Math.floor(Date.now() / 1000) }],
    _seq: { users: 2, chat_history: 1, usage_logs: 1, orders: 1, admins: 2 }
  };
}

function readDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      // 确保所有字段存在
      const d = defaultData();
      for (const key of Object.keys(d)) {
        if (!data[key]) data[key] = d[key];
      }
      return data;
    }
  } catch (e) {
    console.error('readDb error:', e.message);
  }
  return defaultData();
}

function writeDb(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// 自增ID
function nextId(data, table) {
  if (!data._seq[table]) data._seq[table] = 1;
  return data._seq[table]++;
}

let _dbCache = null;
function db() {
  if (!_dbCache) _dbCache = readDb();
  return _dbCache;
}

function save() {
  _dbCache._dirty = true;
  writeDb(_dbCache);
}

// ====== 模拟 pg prepare 接口 ======
function prepare(sql) {
  return {
    get: async (...params) => {
      const data = db();
      // 解析简单 SQL
      if (sql.includes('SELECT') && sql.includes('FROM users WHERE')) {
        return findUser(sql, params, data);
      }
      if (sql.includes('SELECT') && sql.includes('FROM usage_logs')) {
        return findUsageLog(sql, params, data);
      }
      if (sql.includes('SELECT') && sql.includes('FROM chat_history')) {
        return findChat(sql, params, data);
      }
      if (sql.includes('SELECT') && sql.includes('FROM admins')) {
        return findAdmin(sql, params, data);
      }
      if (sql.includes('SELECT') && sql.includes('FROM orders')) {
        return findOrder(sql, params, data);
      }
      if (sql.includes('COUNT(*)')) {
        return countQuery(sql, params, data);
      }
      return null;
    },
    all: async (...params) => {
      const data = db();
      if (sql.includes('FROM users')) return findAllUsers(sql, params, data);
      if (sql.includes('FROM usage_logs')) return findAllUsage(sql, params, data);
      if (sql.includes('FROM chat_history')) return findAllChats(sql, params, data);
      if (sql.includes('FROM orders')) return findAllOrders(sql, params, data);
      if (sql.includes('FROM admins')) return findAllAdmins(data);
      return [];
    },
    run: async (...params) => {
      const data = db();
      if (sql.includes('INSERT INTO users')) return insertUser(sql, params, data);
      if (sql.includes('INSERT INTO chat_history')) return insertChat(sql, params, data);
      if (sql.includes('INSERT INTO usage_logs')) return insertUsage(sql, params, data);
      if (sql.includes('INSERT INTO orders')) return insertOrder(sql, params, data);
      if (sql.includes('INSERT INTO admins')) return insertAdmin(sql, params, data);
      if (sql.includes('UPDATE')) return updateQuery(sql, params, data);
      if (sql.includes('DELETE')) return deleteQuery(sql, params, data);
      return { changes: 0, lastInsertRowid: null };
    }
  };
}

// ====== Users ======
function findUser(sql, params, data) {
  const users = data.users;
  if (sql.includes('phone = ?') || sql.includes('phone = $1')) {
    const phone = params[0];
    return users.find(u => u.phone === phone) || null;
  }
  if (sql.includes('username = ?') || sql.includes('username = $1')) {
    const username = params[0];
    return users.find(u => u.username === username) || null;
  }
  if (sql.includes('email = ?') || sql.includes('email = $1')) {
    const email = params[0];
    return users.find(u => u.email === email) || null;
  }
  if (sql.includes('id = ?') || sql.includes('id = $1')) {
    const id = parseInt(params[0]);
    return users.find(u => u.id === id) || null;
  }
  return null;
}

function findAllUsers(sql, params, data) {
  let users = [...data.users];
  if (sql.includes('LIKE') && params.length >= 5) {
    const kw = String(params[0]).replace(/%/g, '').toLowerCase();
    if (kw) {
      users = users.filter(u =>
        (u.username || '').toLowerCase().includes(kw) ||
        (u.phone || '').includes(kw) ||
        (u.email || '').toLowerCase().includes(kw) ||
        (u.company || '').toLowerCase().includes(kw) ||
        (u.category || '').toLowerCase().includes(kw)
      );
    }
  }
  users.sort((a, b) => b.id - a.id);
  // 分页
  if (params.length >= 7) {
    const limit = parseInt(params[5]);
    const offset = parseInt(params[6]);
    return users.slice(offset, offset + limit);
  }
  if (params.length >= 3) {
    const limit = parseInt(params[1]);
    const offset = parseInt(params[2]);
    return users.slice(offset, offset + limit);
  }
  return users;
}

function insertUser(sql, params, data) {
  const phone = params[0] || params[0];
  const email = params[1] || null;
  const hash = params[2];
  const company = params[3] || '';
  const category = params[4] || '';
  const role = params[5] || '';
  const id = nextId(data, 'users');
  const now = Math.floor(Date.now() / 1000);

  // 字段映射 - 适配新的 registration
  let username = params[0];
  let phoneVal = params[1];
  let passwordHash = params[2];
  let companyVal = params[3];
  let categoryVal = params[4];
  let roleVal = params[5];

  // 智能判断: 如果第1个参数像用户名，按新格式处理
  const user = {
    id,
    username: username || '',
    phone: phoneVal || null,
    email: null,
    password_hash: passwordHash || hash,
    company: companyVal || '',
    category: categoryVal || '',
    role: roleVal || '',
    free_uses_left: 3,
    trial_end_at: 0,
    points: 0,
    membership_type: 'none',
    membership_expires_at: 0,
    total_spent: 0,
    created_at: now,
    updated_at: now,
    last_login_at: 0
  };
  data.users.push(user);
  save();
  return { changes: 1, lastInsertRowid: id };
}

function insertUserNew(data, { username, phone, password_hash, company, category }) {
  const id = nextId(data, 'users');
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id, username, phone, email: null,
    password_hash, company, category,
    role: category,
    free_uses_left: 3, trial_end_at: 0,
    points: 0, membership_type: 'none',
    membership_expires_at: 0, total_spent: 0,
    created_at: now, updated_at: now, last_login_at: 0
  };
  data.users.push(user);
  save();
  return user;
}

// ====== Chat History ======
function findChat(sql, params, data) {
  if (sql.includes('user_id = ?') || sql.includes('user_id = $1')) {
    return data.chat_history.find(c => c.user_id === parseInt(params[0])) || null;
  }
  return null;
}

function findAllChats(sql, params, data) {
  let chats = [...data.chat_history];
  if (params.length > 0 && params[0] && !isNaN(parseInt(params[0]))) {
    const uid = parseInt(params[0]);
    chats = chats.filter(c => c.user_id === uid);
  }
  chats.sort((a, b) => b.id - a.id);
  if (params.length >= 3) {
    const limit = parseInt(params[1]);
    const offset = parseInt(params[2]);
    return chats.slice(offset, offset + limit);
  }
  if (params.length >= 2) {
    const limit = parseInt(params[0]);
    const offset = parseInt(params[1]);
    return chats.slice(offset, offset + limit);
  }
  return chats;
}

function insertChat(sql, params, data) {
  const id = nextId(data, 'chat_history');
  const chat = {
    id,
    user_id: params[0],
    user_message: params[1],
    ai_response: params[2],
    source: params[3],
    created_at: params[4]
  };
  data.chat_history.push(chat);
  save();
  return { changes: 1, lastInsertRowid: id };
}

// ====== Usage Logs ======
function findUsageLog(sql, params, data) {
  if (sql.includes('user_id') && sql.includes('ended_at')) {
    const uid = params[0];
    const now = params[1];
    const logs = data.usage_logs.filter(l => l.user_id === uid && l.ended_at > now);
    logs.sort((a, b) => b.id - a.id);
    return logs[0] || null;
  }
  return null;
}

function findAllUsage(sql, params, data) {
  let logs = [...data.usage_logs];
  if (params.length >= 3) {
    const uid = parseInt(params[0]);
    if (!isNaN(uid)) logs = logs.filter(l => l.user_id === uid);
  }
  logs.sort((a, b) => b.id - a.id);
  return logs;
}

function insertUsage(sql, params, data) {
  const id = nextId(data, 'usage_logs');
  const log = {
    id, user_id: params[0], source: params[1],
    cost_points: params[2], started_at: params[3],
    ended_at: params[4] || 0, duration_minutes: 0, question_count: 0
  };
  data.usage_logs.push(log);
  save();
  return { changes: 1, lastInsertRowid: id };
}

// ====== Orders ======
function findOrder(sql, params, data) {
  if (sql.includes('id')) {
    const id = parseInt(params[0]);
    return data.orders.find(o => o.id === id) || null;
  }
  return null;
}

function findAllOrders(sql, params, data) {
  return [...data.orders].sort((a, b) => b.id - a.id);
}

function insertOrder(sql, params, data) {
  const id = nextId(data, 'orders');
  const order = { id, user_id: params[0], order_type: params[1], amount: params[2], points: params[3], status: params[4], pay_method: null, created_at: params[5], paid_at: 0 };
  data.orders.push(order);
  save();
  return { changes: 1, lastInsertRowid: id };
}

// ====== Admin ======
function findAdmin(sql, params, data) {
  if (sql.includes('username') || sql.includes('id')) {
    const val = params[0];
    return data.admins.find(a => a.username === val || a.id === parseInt(val)) || null;
  }
  return null;
}

function findAllAdmins(data) {
  return data.admins;
}

function insertAdmin(sql, params, data) {
  const id = nextId(data, 'admins');
  const admin = { id, username: params[0], password_hash: params[1], created_at: Math.floor(Date.now() / 1000) };
  data.admins.push(admin);
  save();
  return { changes: 1, lastInsertRowid: id };
}

// ====== Updates ======
function updateQuery(sql, params, data) {
  if (sql.includes('UPDATE users')) {
    const id = parseInt(params[params.length - 1]);
    const user = data.users.find(u => u.id === id);
    if (!user) return { changes: 0 };

    if (sql.includes('last_login_at')) user.last_login_at = params[0];
    if (sql.includes('trial_end_at') && sql.includes('free_uses_left')) {
      user.trial_end_at = params[0];
      // free_uses_left = free_uses_left - 1 is handled in params
    }
    if (sql.includes('points = points')) {
      if (sql.includes('-')) user.points -= params[0];
      if (sql.includes('+')) user.points += params[0];
    }
    if (sql.includes('membership_type') && sql.includes('membership_expires_at')) {
      user.membership_type = params[0];
      user.membership_expires_at = params[1];
    }
    if (sql.includes('total_spent = total_spent +')) {
      user.total_spent += params[params.length - 2];
    }

    // 处理 free_uses_left 递减
    if (sql.includes('free_uses_left = free_uses_left - 1')) {
      user.free_uses_left -= 1;
    }

    save();
    return { changes: 1 };
  }

  if (sql.includes('UPDATE usage_logs')) {
    const id = parseInt(params[params.length - 1]);
    const log = data.usage_logs.find(l => l.id === id);
    if (!log) return { changes: 0 };
    if (sql.includes('question_count')) log.question_count = (log.question_count || 0) + 1;
    save();
    return { changes: 1 };
  }

  if (sql.includes('UPDATE orders')) {
    const id = parseInt(params[params.length - 1]);
    const order = data.orders.find(o => o.id === id);
    if (!order) return { changes: 0 };
    if (sql.includes("status = 'paid'")) {
      order.status = 'paid';
      order.paid_at = params[0];
      order.pay_method = 'mock';
    }
    save();
    return { changes: 1 };
  }

  return { changes: 0 };
}

function deleteQuery(sql, params, data) {
  if (sql.includes('DELETE FROM admins')) {
    const username = params[0];
    const idx = data.admins.findIndex(a => a.username === username);
    if (idx === -1) return { changes: 0 };
    data.admins.splice(idx, 1);
    save();
    return { changes: 1 };
  }
  return { changes: 0 };
}

// ====== Count ======
function countQuery(sql, params, data) {
  if (sql.includes('FROM users')) {
    const likeKw = params[0] ? String(params[0]).replace(/%/g, '').toLowerCase() : '';
    if (likeKw) {
      const count = data.users.filter(u =>
        (u.username || '').toLowerCase().includes(likeKw) ||
        (u.phone || '').includes(likeKw) ||
        (u.email || '').toLowerCase().includes(likeKw) ||
        (u.company || '').toLowerCase().includes(likeKw) ||
        (u.category || '').toLowerCase().includes(likeKw)
      ).length;
      return { c: count };
    }
    return { c: data.users.length };
  }
  if (sql.includes('FROM chat_history')) {
    if (params[0]) {
      const uid = parseInt(params[0]);
      return { c: data.chat_history.filter(c => c.user_id === uid).length };
    }
    return { c: data.chat_history.length };
  }
  if (sql.includes('FROM orders')) {
    if (sql.includes("status = 'paid'") || sql.includes("status = $1")) {
      return { c: data.orders.filter(o => o.status === 'paid').length, s: data.orders.filter(o => o.status === 'paid').reduce((s, o) => s + o.amount, 0) };
    }
    return { c: data.orders.length };
  }
  return { c: 0 };
}

// ====== 额外暴露方法给 routes 使用 ======
module.exports = {
  prepare,
  insertUserNew,
  readDb,
  writeDb,
  findUserByUsername: (username) => {
    return db().users.find(u => u.username === username) || null;
  },
  findUserByPhone: (phone) => {
    return db().users.find(u => u.phone === phone) || null;
  },
  findUserById: (id) => {
    return db().users.find(u => u.id === id) || null;
  },
  getUserById: (id) => {
    return db().users.find(u => u.id === id) || null;
  }
};
