'use strict';

const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const config = require('../config');
const { Media, CATEGORIES } = require('../models/Media');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1, fields: 6 },
});

// Dosya içeriğinin gerçekten izin verilen bir görsel olduğunu imzasından doğrular
function detectImageType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (['GIF87a', 'GIF89a'].includes(buf.subarray(0, 6).toString('ascii'))) return 'image/gif';
  return null;
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
}

function validId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Geçersiz kayıt kimliği.' });
  }
  next();
}

// Genel: galeri listesi
router.get('/', async (req, res, next) => {
  try {
    const items = await Media.find().sort({ order: 1, createdAt: 1 });
    res.json(items.map((item) => item.toPublic()));
  } catch (err) {
    next(err);
  }
});

// Genel: görsel verisi
router.get('/:id/image', validId, async (req, res, next) => {
  try {
    const item = await Media.findById(req.params.id).select('+image.data image.contentType');
    if (!item) return res.status(404).end();
    res.set({
      'Content-Type': item.image.contentType,
      'Content-Length': item.image.data.length,
      'Cache-Control': 'public, max-age=604800, immutable',
      'Content-Disposition': 'inline',
    });
    res.end(item.image.data);
  } catch (err) {
    next(err);
  }
});

// Yönetici: yeni medya yükle
router.post('/', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Görsel dosyası seçilmedi.' });

    const contentType = detectImageType(req.file.buffer);
    if (!contentType) {
      return res.status(415).json({ error: 'Yalnızca JPG, PNG, WEBP ve GIF dosyaları yüklenebilir.' });
    }

    const title = cleanText(req.body.title, 80);
    if (!title) return res.status(400).json({ error: 'Medya başlığı zorunludur.' });

    const category = CATEGORIES.includes(req.body.category) ? req.body.category : 'genel';
    const last = await Media.findOne().sort({ order: -1 }).select('order');

    const item = await Media.create({
      title,
      description: cleanText(req.body.description, 300),
      category,
      order: last ? last.order + 1 : 0,
      size: req.file.size,
      image: { data: req.file.buffer, contentType },
    });
    res.status(201).json(item.toPublic());
  } catch (err) {
    next(err);
  }
});

// Yönetici: sıralamayı kaydet (diğer rotalardan önce tanımlanmalı)
router.put('/order', requireAuth, async (req, res, next) => {
  try {
    const ids = req.body && req.body.ids;
    if (!Array.isArray(ids) || ids.length > 500 || !ids.every((id) => typeof id === 'string' && mongoose.isValidObjectId(id))) {
      return res.status(400).json({ error: 'Geçersiz sıralama verisi.' });
    }
    await Media.bulkWrite(ids.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: index } } } })));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Yönetici: başlık, açıklama ve kategori güncelle
router.patch('/:id', requireAuth, validId, async (req, res, next) => {
  try {
    const update = {};
    if ('title' in req.body) {
      const title = cleanText(req.body.title, 80);
      if (!title) return res.status(400).json({ error: 'Başlık boş bırakılamaz.' });
      update.title = title;
    }
    if ('description' in req.body) update.description = cleanText(req.body.description, 300);
    if ('category' in req.body) {
      if (!CATEGORIES.includes(req.body.category)) return res.status(400).json({ error: 'Geçersiz kategori.' });
      update.category = req.body.category;
    }

    const item = await Media.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    res.json(item.toPublic());
  } catch (err) {
    next(err);
  }
});

// Yönetici: sil
router.delete('/:id', requireAuth, validId, async (req, res, next) => {
  try {
    const item = await Media.findByIdAndDelete(req.params.id).select('_id');
    if (!item) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Multer hatalarını anlaşılır mesajlara çevirir
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Dosya boyutu en fazla 8 MB olabilir.' : 'Dosya yüklenemedi.';
    return res.status(400).json({ error: message });
  }
  next(err);
});

module.exports = router;
