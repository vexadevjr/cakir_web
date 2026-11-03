'use strict';

const LoginAttempt = require('../models/LoginAttempt');
const { normalizeIp, cleanText } = require('../utils/ip');
const { logError } = require('../utils/redact');

// Giriş denemesini kaydeder; kayıt hatası girişi asla engellemez
function recordLogin(req, reason) {
  const body = req.body || {};
  LoginAttempt.create({
    ip: normalizeIp(req.ip),
    username: cleanText(body.username, 40),
    success: reason === 'success',
    reason,
    ua: cleanText(req.get('user-agent'), 200),
  }).catch((err) => logError('[Denetim] Giriş kaydı yazılamadı:', err));
}

module.exports = { recordLogin };
