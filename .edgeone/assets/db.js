const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const isNeon = (process.env.DATABASE_URL || '').includes('neon.tech');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isNeon ? { rejectUnauthorized: false } : false,
});

async function query(text, params) {
  return pool.query(text, params);
}

// 兼容 better-sqlite3 风格的轻量封装
function prepare(sql) {
  let idx = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++idx}`);

  return {
    get: async (...params) => {
      const result = await pool.query(pgSql, params);
      return result.rows[0] || null;
    },
    all: async (...params) => {
      const result = await pool.query(pgSql, params);
      return result.rows;
    },
    run: async (...params) => {
      const result = await pool.query(pgSql, params);
      return {
        changes: result.rowCount,
        lastInsertRowid: result.rows[0]?.id || null,
      };
    },
  };
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      phone TEXT UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      company TEXT DEFAULT '',
      category TEXT DEFAULT '',
      role TEXT DEFAULT '',
      free_uses_left INTEGER DEFAULT 3,
      trial_end_at INTEGER DEFAULT 0,
      points INTEGER DEFAULT 0,
      membership_type TEXT DEFAULT 'none',
      membership_expires_at INTEGER DEFAULT 0,
      total_spent REAL DEFAULT 0,
      created_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
      updated_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
      last_login_at INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_message TEXT NOT NULL,
      ai_response TEXT NOT NULL,
      source TEXT DEFAULT 'unknown',
      created_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      cost_points INTEGER DEFAULT 0,
      started_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
      ended_at INTEGER DEFAULT 0,
      duration_minutes INTEGER DEFAULT 0,
      question_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_type TEXT NOT NULL,
      amount REAL NOT NULL,
      points INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      pay_method TEXT,
      created_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
      paid_at INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_chat_user_id ON chat_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_history(created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
  `);

  // 尝试为已有用户补充 username（如果没有则用 phone/email/id）
  try {
    await pool.query(`UPDATE users SET username = COALESCE(phone, email, 'user_' || id) WHERE username IS NULL`);
  } catch (e) {
    // 列可能已存在或不存在，忽略
    console.log('username migration note:', e.message);
  }

  // 初始化管理员
  const adminResult = await pool.query('SELECT id FROM admins WHERE username = $1', ['qaq']);
  if (adminResult.rows.length === 0) {
    const hash = bcrypt.hashSync('qaq881205', 10);
    await pool.query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', ['qaq', hash]);
  }
}

module.exports = { pool, query, prepare, initDb };
