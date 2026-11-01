'use strict';

const mongoose = require('mongoose');
const config = require('./index');

async function connectDB() {
  mongoose.set('strictQuery', true);
  mongoose.connection.on('error', (err) => console.error('[MongoDB] Bağlantı hatası:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('[MongoDB] Bağlantı koptu.'));

  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log('[MongoDB] Bağlantı kuruldu.');
}

module.exports = { connectDB };
