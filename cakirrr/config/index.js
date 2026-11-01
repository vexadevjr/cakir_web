'use strict';

require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';

function required(name) {
  const value = (process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} değişkeni .env dosyasında tanımlanmalıdır.`);
  }
  return value;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET en az 32 karakter olmalıdır.');
}

const adminPassword = required('ADMIN_PASSWORD');
if (isProd && adminPassword.length < 12) {
  throw new Error('Production ortamında ADMIN_PASSWORD en az 12 karakter olmalıdır.');
}

module.exports = {
  isProd,
  port: parseInt(process.env.PORT, 10) || 3000,
  trustProxy: parseInt(process.env.TRUST_PROXY, 10) || 0,
  mongoUri: required('MONGODB_URI'),
  adminUsername: required('ADMIN_USERNAME'),
  adminPassword,
  jwtSecret,
  sessionHours: parseInt(process.env.SESSION_HOURS, 10) || 8,
  cookieSecure: process.env.COOKIE_SECURE !== 'false',
  discordBotToken: (process.env.DISCORD_BOT_TOKEN || '').trim(),
  seedDemo: process.env.SEED_DEMO !== 'false',
  maxUploadBytes: 8 * 1024 * 1024,
};
