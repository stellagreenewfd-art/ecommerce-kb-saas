// EdgeOne node-functions shared database helper
const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    const isNeon = (process.env.DATABASE_URL || '').includes('neon.tech');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isNeon ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

async function query(text, params) {
  const p = getPool();
  return p.query(text, params);
}

async function initDb() {
  const p = getPool();
  await p.query(`
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
    CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
  `);

  const bcrypt = require('bcryptjs');
  const adminResult = await p.query('SELECT id FROM admins WHERE username = $1', ['qaq']);
  if (adminResult.rows.length === 0) {
    const hash = bcrypt.hashSync('qaq881205', 10);
    await p.query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', ['qaq', hash]);
  }
}

module.exports = { getPool, query, initDb };
