const { ok, handleOptions } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  ok(res, {
    pricing: {
      month: 99,
      year: 499,
      points: { 50: 49, 100: 89, 200: 159, 500: 349, 1000: 599 }
    }
  });
};
