'use strict';

const express = require('express');
const mongoose = require('mongoose');
const config = require('../config');
const Visit = require('../models/Visit');
const LoginAttempt = require('../models/LoginAttempt');
const { requireAuth } = require('../middleware/auth');
const { buildRange } = require('../utils/range');

const router = express.Router();
const RANGES = ['day', 'week', 'month', 'year'];
const VISITOR_LIMIT = 300;

router.use(requireAuth); // Tüm istatistik uç noktaları yalnızca yöneticiye açıktır

const notBot = { bot: { $ne: true } };

// Bir aralık için toplam ziyaret ve tekil ziyaretçi (IP) sayısı
async function totals(start) {
  const [row] = await Visit.aggregate([
    { $match: { createdAt: { $gte: start }, ...notBot } },
    { $group: { _id: '$ip', c: { $sum: 1 } } },
    { $group: { _id: null, views: { $sum: '$c' }, uniques: { $sum: 1 } } },
  ]);
  return { views: row ? row.views : 0, uniques: row ? row.uniques : 0 };
}

// Grafik noktaları: kova başına ziyaret ve tekil ziyaretçi, boş kovalar sıfırla doldurulur
async function series(spec) {
  const rows = await Visit.aggregate([
    { $match: { createdAt: { $gte: spec.start }, ...notBot } },
    { $group: { _id: { b: { $dateToString: { format: spec.format, date: '$createdAt', timezone: config.statsTimezone } }, ip: '$ip' }, c: { $sum: 1 } } },
    { $group: { _id: '$_id.b', views: { $sum: '$c' }, uniques: { $sum: 1 } } },
  ]);
  const byKey = new Map(rows.map((r) => [r._id, r]));
  return spec.keys.map((key) => {
    const r = byKey.get(key);
    return { key, views: r ? r.views : 0, uniques: r ? r.uniques : 0 };
  });
}

// Özet kartları + seçilen aralığın grafiği
router.get('/overview', async (req, res, next) => {
  try {
    const range = RANGES.includes(req.query.range) ? req.query.range : 'week';
    const now = new Date();
    const specs = Object.fromEntries(RANGES.map((r) => [r, buildRange(r, now, config.statsTimezone)]));
    const [day, week, month, year, points, allTime] = await Promise.all([
      totals(specs.day.start), totals(specs.week.start), totals(specs.month.start), totals(specs.year.start),
      series(specs[range]),
      Visit.estimatedDocumentCount(),
    ]);
    res.json({
      range,
      unit: specs[range].unit,
      timezone: config.statsTimezone,
      retentionDays: config.logRetentionDays,
      totals: { day, week, month, year },
      points,
      recordedVisits: allTime,
    });
  } catch (err) {
    next(err);
  }
});

// Ziyaretçi IP listesi (IP başına gruplanmış)
router.get('/visitors', async (req, res, next) => {
  try {
    const range = req.query.range === 'all' ? 'all' : RANGES.includes(req.query.range) ? req.query.range : 'week';
    const includeBots = req.query.bots === '1';
    const match = {};
    if (range !== 'all') match.createdAt = { $gte: buildRange(range, new Date(), config.statsTimezone).start };
    if (!includeBots) match.bot = { $ne: true };

    const rows = await Visit.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$ip', views: { $sum: 1 }, firstSeen: { $min: '$createdAt' }, lastSeen: { $max: '$createdAt' }, lastPath: { $first: '$path' }, ua: { $first: '$ua' }, bot: { $first: '$bot' } } },
      { $sort: { lastSeen: -1 } },
      { $limit: VISITOR_LIMIT + 1 },
    ]);
    res.json({
      range,
      truncated: rows.length > VISITOR_LIMIT,
      items: rows.slice(0, VISITOR_LIMIT).map((r) => ({ ip: r._id, views: r.views, firstSeen: r.firstSeen, lastSeen: r.lastSeen, lastPath: r.lastPath, ua: r.ua, bot: Boolean(r.bot) })),
    });
  } catch (err) {
    next(err);
  }
});

// Yönetici giriş denemeleri + özet
router.get('/logins', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.result === 'failed') filter.success = false;
    if (req.query.result === 'success') filter.success = true;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 500);

    const since24h = new Date(Date.now() - 24 * 3600 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const [items, ok24, failed24, topFailed] = await Promise.all([
      LoginAttempt.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
      LoginAttempt.countDocuments({ success: true, createdAt: mongoose.trusted({ $gte: since24h }) }),
      LoginAttempt.countDocuments({ success: false, createdAt: mongoose.trusted({ $gte: since24h }) }),
      LoginAttempt.aggregate([
        { $match: { success: false, createdAt: { $gte: since7d } } },
        { $group: { _id: '$ip', attempts: { $sum: 1 }, lastAt: { $max: '$createdAt' } } },
        { $sort: { attempts: -1 } },
        { $limit: 10 },
      ]),
    ]);

    res.json({
      summary: { success24h: ok24, failed24h: failed24, topFailed: topFailed.map((r) => ({ ip: r._id, attempts: r.attempts, lastAt: r.lastAt })) },
      items: items.map((a) => ({ id: String(a._id), ip: a.ip, username: a.username, success: a.success, reason: a.reason, ua: a.ua, createdAt: a.createdAt })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
