'use strict';

const mongoose = require('mongoose');
const config = require('../config');

const REASONS = ['success', 'bad_credentials', 'rate_limited'];

// Yönetici giriş denemeleri (başarılı ve başarısız); süre dolunca otomatik silinir
const loginAttemptSchema = new mongoose.Schema({
  ip: { type: String, required: true, maxlength: 64 },
  username: { type: String, maxlength: 40, default: '' },
  success: { type: Boolean, required: true },
  reason: { type: String, enum: REASONS, required: true },
  ua: { type: String, maxlength: 200, default: '' },
  createdAt: { type: Date, default: Date.now, index: { expires: config.logRetentionDays * 24 * 60 * 60 } },
});

loginAttemptSchema.index({ ip: 1, createdAt: -1 });

module.exports = mongoose.model('LoginAttempt', loginAttemptSchema);
