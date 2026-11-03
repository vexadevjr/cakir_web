'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { recordLogin } = require('../services/audit');
const { issueSession, readSession, clearSession, safeEqual, requireAuth } = require('../middleware/auth');

const router = express.Router();

// Kimlik doğrulama yanıtları hiçbir zaman önbelleğe alınmaz
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Kaba kuvvet koruması, iki katman:
// 1) IP başına 15 dakikada en fazla 8 başarısız deneme
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res) => {
    await recordLogin(req, 'rate_limited');
    res.status(429).json({
        error: 'Çok fazla başarısız deneme. Lütfen 15 dakika sonra tekrar deneyin.'
    });
},

// 2) Saldırı birçok IP'den dağıtık yapılsa bile saatte en fazla 40 başarısız deneme
const globalLoginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  skipSuccessfulRequests: true,
  keyGenerator: () => 'login-global',
  standardHeaders: false,
  legacyHeaders: false,
  handler: async (req, res) => {
    await recordLogin(req, 'rate_limited');
    res.status(429).json({
        error: 'Giriş geçici olarak kilitlendi. Lütfen daha sonra tekrar deneyin.'
    });
},

router.post('/login', globalLoginLimiter, loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || username.length > 100 || password.length > 200) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
    }

    // İki alan da her durumda karşılaştırılır; hangisinin yanlış olduğu belli olmaz
    const userOk = safeEqual(username, config.adminUsername);
    const passOk = safeEqual(password, config.adminPassword);
    if (!(userOk && passOk)) {
      recordLogin(req, 'bad_credentials');
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    }

    const csrf = await issueSession(res, config.adminUsername);
    recordLogin(req, 'success');
    res.json({ username: config.adminUsername, csrf });
  } catch (err) {
    next(err);
  }
});

router.get('/me', async (req, res, next) => {
  try {
    const session = await readSession(req);
    if (!session) return res.status(401).json({ error: 'Oturum yok.' });
    res.json({ username: session.sub, csrf: session.csrf });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await clearSession(req, res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
