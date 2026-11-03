
'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { recordLogin } = require('../services/audit');
const {
  issueSession,
  readSession,
  clearSession,
  safeEqual,
  requireAuth
} = require('../middleware/auth');

const router = express.Router();

// Kimlik doğrulama yanıtları hiçbir zaman önbelleğe alınmaz
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// IP başına 15 dakikada en fazla 8 başarısız deneme
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
});

// Global giriş koruması
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
});

// Yönetici girişi
router.post(
  '/login',
  globalLoginLimiter,
  loginLimiter,
  async (req, res, next) => {
    try {
      const { username, password } = req.body || {};

      if (
        typeof username !== 'string' ||
        typeof password !== 'string' ||
        username.length > 100 ||
        password.length > 200
      ) {
        return res.status(400).json({
          error: 'Kullanıcı adı ve şifre gereklidir.'
        });
      }

      const userOk = safeEqual(username, config.adminUsername);
      const passOk = safeEqual(password, config.adminPassword);

      // Başarısız giriş
      if (!(userOk && passOk)) {
        await recordLogin(req, 'bad_credentials');

        return res.status(401).json({
          error: 'Kullanıcı adı veya şifre hatalı.'
        });
      }

      // Başarılı giriş
      const csrf = await issueSession(res, config.adminUsername);

      await recordLogin(req, 'success');

      return res.json({
        username: config.adminUsername,
        csrf
      });

    } catch (err) {
      next(err);
    }
  }
);


// Oturum kontrolü
router.get('/me', requireAuth, (req, res) => {
  res.json({
    authenticated: true,
    username: req.admin.sub,
    csrf: req.admin.csrf
  });
});

// Oturum kapatma
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await clearSession(req, res);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

