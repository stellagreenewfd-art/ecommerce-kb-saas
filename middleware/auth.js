const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'ecommerce-kb-jwt-secret-change-in-production';
const TOKEN_EXPIRES = '7d';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });
}

function verifyToken(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ ok: false, message: '未登录' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, message: '登录已过期' });
  }
}

function verifyAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ ok: false, message: '未登录' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = db.prepare('SELECT id FROM admins WHERE id = ?').get(decoded.adminId);
    if (!admin) return res.status(403).json({ ok: false, message: '无权限' });
    req.admin = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, message: '登录已过期' });
  }
}

function adminSignToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });
}

module.exports = { signToken, verifyToken, verifyAdmin, adminSignToken, JWT_SECRET };
