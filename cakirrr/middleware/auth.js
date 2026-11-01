'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

const COOKIE_NAME = 'cakir_admin';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Uzunluk bilgisi sızdırmadan sabit zamanlı karşılaştırma
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: config.sessionHours * 60 * 60 * 1000,
  };
}

function issueSession(res, username) {
  const csrf = crypto.randomBytes(24).toString('hex');
  const token = jwt.sign({ sub: username, csrf }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: `${config.sessionHours}h`,
  });
  res.cookie(COOKIE_NAME, token, cookieOptions());
  return csrf;
}

function readSession(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const session = readSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş.' });
  }
  // Durum değiştiren isteklerde CSRF belirteci zorunlu
  if (!SAFE_METHODS.has(req.method)) {
    const header = req.get('x-csrf-token');
    if (!header || !safeEqual(header, session.csrf)) {
      return res.status(403).json({ error: 'Güvenlik doğrulaması başarısız.' });
    }
  }
  req.admin = session;
  next();
}

function clearSession(res) {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(COOKIE_NAME, opts);
}

module.exports = { requireAuth, issueSession, readSession, clearSession, safeEqual };
