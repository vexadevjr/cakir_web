'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const Session = require('../models/Session');

// HTTPS'te __Host- öneki çerezin yalnızca bu alan adına ve güvenli bağlantıya bağlanmasını sağlar
const COOKIE_NAME = config.cookieSecure ? '__Host-cakir_admin' : 'cakir_admin';
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

async function issueSession(res, username) {
  const csrf = crypto.randomBytes(24).toString('hex');
  const jti = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + config.sessionHours * 60 * 60 * 1000);

  await Session.create({ jti, username, expiresAt });
  const token = jwt.sign({ sub: username, csrf }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: `${config.sessionHours}h`,
    jwtid: jti,
  });
  res.cookie(COOKIE_NAME, token, cookieOptions());
  return csrf;
}

// Token imzası geçerli olsa bile sunucuda kayıtlı bir oturuma ait olmalıdır
async function readSession(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
  if (!payload.jti || !(await Session.exists({ jti: payload.jti }))) return null;
  return payload;
}

async function requireAuth(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store');
    const session = await readSession(req);
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
  } catch (err) {
    next(err);
  }
}

async function clearSession(req, res) {
  if (req.admin && req.admin.jti) await Session.deleteOne({ jti: req.admin.jti });
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(COOKIE_NAME, opts);
}

module.exports = { requireAuth, issueSession, readSession, clearSession, safeEqual };
