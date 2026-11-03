'use strict';

const rateLimit = require('express-rate-limit');
const Visit = require('../models/Visit');
const { normalizeIp, cleanText } = require('../utils/ip');
const { logError } = require('../utils/redact');

// Ziyaret sayılacak sayfalar (yönetim paneli ve API sayılmaz)
const PAGE_PATHS = {
  '/': '/',
  '/index.html': '/',
  '/galeri': '/galeri',
  '/pages/galeri.html': '/galeri',
  '/pages/gizlilik.html': '/pages/gizlilik.html',
  '/pages/kullanim-kosullari.html': '/pages/kullanim-kosullari.html',
};

const BOT_PATTERN = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|curl|wget|python-requests|httpclient|monitor|uptime|preview/i;
const DEDUPE_MS = 30 * 1000; // Aynı IP aynı sayfayı 30 sn içinde yenilerse tek ziyaret sayılır
const recent = new Map();

function seenRecently(key) {
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < DEDUPE_MS) return true;
  recent.set(key, now);
  if (recent.size > 20000) {
    for (const [k, t] of recent) if (now - t > DEDUPE_MS) recent.delete(k);
    if (recent.size > 20000) recent.clear();
  }
  return false;
}

// Sayfa adreslerine yönelik aşırı istekleri sınırlar (kayıt şişirme saldırılarına karşı)
const pageLimiter = rateLimit({ windowMs: 60 * 1000, limit: 240, standardHeaders: false, legacyHeaders: false });

function track(adminCookieName) {
  return function trackVisit(req, res, next) {
    // Yönetici çerezi taşıyan istekler (sitenin sahibi gezerken) istatistiğe katılmaz
    const isAdmin = req.cookies && req.cookies[adminCookieName];
    const wantsHtml = (req.get('accept') || '').includes('text/html');

    if (!isAdmin && wantsHtml) {
      res.on('finish', () => {
        if (res.statusCode >= 400) return;
        const path = PAGE_PATHS[req.path];
        const ip = normalizeIp(req.ip);
        if (!path || seenRecently(`${ip}|${path}`)) return;

        const ua = cleanText(req.get('user-agent'), 200);
        Visit.create({ ip, path, ua, bot: BOT_PATTERN.test(ua) || !ua }).catch((err) => logError('[İzleme] Ziyaret kaydı yazılamadı:', err));
      });
    }
    next();
  };
}

module.exports = { track, pageLimiter, PAGE_PATHS: Object.keys(PAGE_PATHS) };
