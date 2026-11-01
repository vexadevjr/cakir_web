'use strict';

const mongoose = require('mongoose');

// Sunucu tarafı oturum kaydı: çıkış yapıldığında veya süre dolduğunda token geçersiz sayılır
const sessionSchema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

module.exports = mongoose.model('Session', sessionSchema);
