// Vercel Serverless Function entry
require('../env-loader').loadEnv();

const app = require('../server');
const { initDb } = require('../db');

let initialized = false;

module.exports = async (req, res) => {
  if (!initialized) {
    try {
      await initDb();
      initialized = true;
    } catch (err) {
      console.error('Database init failed:', err);
      return res.status(500).json({ ok: false, message: '数据库初始化失败' });
    }
  }
  return app(req, res);
};
