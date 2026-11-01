'use strict';

const mongoose = require('mongoose');
const config = require('./index');
const { logError } = require('../utils/redact');

async function connectDB() {
  mongoose.set('strictQuery', true);
  // Sorgulara sızabilecek $ operatörlerini etkisiz hale getirir (NoSQL injection)
  mongoose.set('sanitizeFilter', true);
  mongoose.connection.on('error', (err) => logError('[MongoDB] Bağlantı hatası:', err));
  mongoose.connection.on('disconnected', () => console.warn('[MongoDB] Bağlantı koptu.'));

  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log('[MongoDB] Bağlantı kuruldu.');
}

module.exports = { connectDB };
