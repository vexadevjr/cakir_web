'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { issueSession, readSession, clearSession, safeEqual, requireAuth } = require('../middleware/auth');

const router = express.Router();

// Kaba kuvvet saldırılarına karşı: 15 dakikada en fazla 8 başarısız deneme
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla başarısız deneme. Lütfen 15 dakika sonra tekrar deneyin.' },
});

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
  }

  // İki alan da her durumda karşılaştırılır; hangisinin yanlış olduğu belli olmaz
  const userOk = safeEqual(username, config.adminUsername);
  const passOk = safeEqual(password, config.adminPassword);
  if (!(userOk && passOk)) {
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
  }

  const csrf = issueSession(res, config.adminUsername);
  res.json({ username: config.adminUsername, csrf });
});

router.get('/me', (req, res) => {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: 'Oturum yok.' });
  res.json({ username: session.sub, csrf: session.csrf });
});

router.post('/logout', requireAuth, (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

module.exports = router;
