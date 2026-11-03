'use strict';

const mongoose = require('mongoose');
const config = require('../config');

// Sayfa ziyareti kaydı; süre dolunca MongoDB tarafından otomatik silinir
const visitSchema = new mongoose.Schema({
  ip: { type: String, required: true, maxlength: 64 },
  path: { type: String, required: true, maxlength: 120 },
  ua: { type: String, maxlength: 200, default: '' },
  bot: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, index: { expires: config.logRetentionDays * 24 * 60 * 60 } },
});

visitSchema.index({ ip: 1, createdAt: -1 });

module.exports = mongoose.model('Visit', visitSchema);
