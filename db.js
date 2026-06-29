const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'app.db');
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    company TEXT,
    role TEXT,
    free_uses_left INTEGER DEFAULT 3,
    trial_end_at INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    membership_type TEXT DEFAULT 'none', -- none / month / year
    membership_expires_at INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now')),
    last_login_at INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    source TEXT NOT NULL, -- free / points / membership
    cost_points INTEGER DEFAULT 0,
    started_at INTEGER DEFAULT (strftime('%s','now')),
    ended_at INTEGER DEFAULT 0,
    duration_minutes INTEGER DEFAULT 0,
    question_count INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    order_type TEXT NOT NULL, -- points / month / year
    amount REAL NOT NULL,
    points INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending', -- pending / paid / cancelled
    pay_method TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    paid_at INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
`);

// 初始化管理员账号: qaq / qaq881205
const qaqExists = db.prepare("SELECT id FROM admins WHERE username = ?").get('qaq');
if (!qaqExists) {
  const hash = bcrypt.hashSync('qaq881205', 10);
  db.prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)").run('qaq', hash);
}

// 兼容旧默认账号: 如果存在 admin/admin123, 删除它 (避免弱密码暴露)
const oldAdmin = db.prepare("SELECT id FROM admins WHERE username = ?").get('admin');
if (oldAdmin) {
  db.prepare("DELETE FROM admins WHERE username = ?").run('admin');
}

module.exports = db;
