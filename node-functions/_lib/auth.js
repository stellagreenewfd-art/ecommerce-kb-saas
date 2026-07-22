// EdgeOne node-functions shared auth middleware
const jwt = require('jsonwebtoken');
const { query } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'ecommerce-kb-jwt-secret-change-in-production';
const TOKEN_EXPIRES = '7d';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });
}

function adminSignToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });
}

// 解析请求中的 token
function parseToken(req) {
  const auth = req.headers.authorization || '';
  return auth.replace(/^Bearer\s+/i, '');
}

// 验证用户 token
function verifyToken(req) {
  const token = parseToken(req);
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

// 验证管理员 token
async function verifyAdmin(req) {
  const token = parseToken(req);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await query('SELECT id FROM admins WHERE id = $1', [decoded.adminId]);
    if (result.rows.length === 0) return null;
    return decoded;
  } catch (e) {
    return null;
  }
}

// 简易响应助手
function json(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

function ok(res, data = {}) {
  json(res, { ok: true, ...data });
}

function fail(res, message, status = 200) {
  json(res, { ok: false, message }, status);
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

// OPTIONS 预检请求处理
function handleOptions(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.statusCode = 204;
  res.end();
}

module.exports = {
  signToken, adminSignToken, verifyToken, verifyAdmin,
  json, ok, fail, parseBody, handleOptions
};
