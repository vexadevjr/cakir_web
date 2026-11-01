'use strict';

const express = require('express');
const mongoose = require('mongoose');
const { TeamMember, TONES } = require('../models/TeamMember');
const { requireAuth } = require('../middleware/auth');
const discord = require('../services/discord');

const router = express.Router();
const STALE_MS = 6 * 60 * 60 * 1000;
let refreshing = false;

function cleanText(value, max) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
}

function validId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Geçersiz kayıt kimliği.' });
  next();
}

function sendError(res, next, err) {
  if (err && err.status) return res.status(err.status).json({ error: err.message });
  if (err && err.code === 11000) return res.status(409).json({ error: 'Bu Discord hesabı zaten listede.' });
  next(err);
}

async function applyProfile(member) {
  const profile = await discord.fetchProfile(member.discordId);
  member.discordUsername = profile.username;
  member.avatarUrl = profile.avatarUrl;
  member.syncedAt = new Date();
  return profile;
}

// Kullanıcı profil fotoğrafını değiştirdiğinde eski görsel kalmasın diye arka planda tazelenir
async function refreshStale(members) {
  if (refreshing || !discord.isConfigured()) return;
  const stale = members.filter((m) => m.discordId && (!m.syncedAt || Date.now() - m.syncedAt.getTime() > STALE_MS));
  if (!stale.length) return;
  refreshing = true;
  try {
    for (const member of stale) {
      try {
        await applyProfile(member);
        await member.save();
      } catch (err) {
        if (err.status === 429) break;
      }
    }
  } finally {
    refreshing = false;
  }
}

// Genel: kadro listesi
router.get('/', async (req, res, next) => {
  try {
    const members = await TeamMember.find().sort({ order: 1, createdAt: 1 });
    res.set('Cache-Control', 'public, max-age=60');
    res.json(members.map((m) => m.toPublic()));
    refreshStale(members);
  } catch (err) {
    next(err);
  }
});

// Yönetici: ayrıntılı liste
router.get('/admin', requireAuth, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const members = await TeamMember.find().sort({ order: 1, createdAt: 1 });
    res.json({ discordConfigured: discord.isConfigured(), items: members.map((m) => m.toAdmin()) });
  } catch (err) {
    next(err);
  }
});

// Yönetici: yeni üye (Discord ID ile profil otomatik çekilir)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const role = cleanText(body.role, 40);
    const discordId = cleanText(body.discordId, 25);
    let name = cleanText(body.name, 40);
    if (!role) return res.status(400).json({ error: 'Rütbe alanı zorunludur.' });
    if (!discordId && !name) return res.status(400).json({ error: 'Discord ID veya isim girin.' });

    const last = await TeamMember.findOne().sort({ order: -1 }).select('order');
    const member = new TeamMember({
      role,
      tone: TONES.includes(body.tone) ? body.tone : 'staff',
      order: last ? last.order + 1 : 0,
    });

    if (discordId) {
      if (!discord.ID_PATTERN.test(discordId)) {
        return res.status(400).json({ error: 'Discord ID yalnızca 17-20 haneli rakamlardan oluşmalıdır.' });
      }
      member.discordId = discordId;
      const profile = await applyProfile(member);
      name = name || profile.displayName;
    }
    member.name = name;

    await member.save();
    res.status(201).json(member.toAdmin());
  } catch (err) {
    sendError(res, next, err);
  }
});

// Yönetici: sıralama
router.put('/order', requireAuth, async (req, res, next) => {
  try {
    const ids = req.body && req.body.ids;
    if (!Array.isArray(ids) || ids.length > 100 || !ids.every((id) => typeof id === 'string' && mongoose.isValidObjectId(id))) {
      return res.status(400).json({ error: 'Geçersiz sıralama verisi.' });
    }
    await TeamMember.bulkWrite(ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } })));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Yönetici: isim, rütbe, renk güncelle
router.patch('/:id', requireAuth, validId, async (req, res, next) => {
  try {
    const update = {};
    const body = req.body || {};
    if ('name' in body) {
      update.name = cleanText(body.name, 40);
      if (!update.name) return res.status(400).json({ error: 'İsim boş bırakılamaz.' });
    }
    if ('role' in body) {
      update.role = cleanText(body.role, 40);
      if (!update.role) return res.status(400).json({ error: 'Rütbe boş bırakılamaz.' });
    }
    if ('tone' in body) {
      if (!TONES.includes(body.tone)) return res.status(400).json({ error: 'Geçersiz renk seçimi.' });
      update.tone = body.tone;
    }
    const member = await TeamMember.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
    if (!member) return res.status(404).json({ error: 'Üye bulunamadı.' });
    res.json(member.toAdmin());
  } catch (err) {
    next(err);
  }
});

// Yönetici: Discord profilini yeniden çek
router.post('/:id/refresh', requireAuth, validId, async (req, res, next) => {
  try {
    const member = await TeamMember.findById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Üye bulunamadı.' });
    if (!member.discordId) return res.status(400).json({ error: 'Bu üyeye Discord hesabı bağlı değil.' });
    await applyProfile(member);
    await member.save();
    res.json(member.toAdmin());
  } catch (err) {
    sendError(res, next, err);
  }
});

router.delete('/:id', requireAuth, validId, async (req, res, next) => {
  try {
    const member = await TeamMember.findByIdAndDelete(req.params.id).select('_id');
    if (!member) return res.status(404).json({ error: 'Üye bulunamadı.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
