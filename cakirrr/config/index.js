'use strict';

require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
// Render otomatik olarak RENDER=true tanımlar; bu ortamda proxy arkasında çalışıldığı bilinir
const onRender = Boolean(process.env.RENDER);

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

const ID_PATTERN = /^\d{17,20}$/;
function optionalId(name) {
  const value = (process.env[name] || '').trim();
  if (value && !ID_PATTERN.test(value)) {
    throw new Error(`${name} 17-20 haneli bir Discord ID olmalıdır.`);
  }
  return value;
}

const WEAK_PASSWORDS = new Set(['en-az-12-karakterlik-guclu-bir-sifre', 'password', 'admin', '12345678', 'cakir123', 'changeme']);
const adminPassword = required('ADMIN_PASSWORD');
if (WEAK_PASSWORDS.has(adminPassword.toLowerCase())) {
  throw new Error('ADMIN_PASSWORD tahmin edilmesi kolay bir değer; lütfen güçlü bir şifre belirleyin.');
}
if (isProd && adminPassword.length < 12) {
  throw new Error('Production ortamında ADMIN_PASSWORD en az 12 karakter olmalıdır.');
}

const adminUsername = required('ADMIN_USERNAME');
if (adminPassword === adminUsername) {
  throw new Error('ADMIN_PASSWORD kullanıcı adıyla aynı olamaz.');
}

// Ziyaret ve giriş kayıtlarının saklanacağı gün sayısı (sonrasında MongoDB otomatik siler)
const logRetentionDays = Math.max(1, parseInt(process.env.LOG_RETENTION_DAYS, 10) || 400);

// Grafik gün/saat sınırlarının hesaplanacağı saat dilimi
const statsTimezone = (process.env.STATS_TIMEZONE || 'Europe/Istanbul').trim();
try {
  new Intl.DateTimeFormat('en-US', { timeZone: statsTimezone });
} catch {
  throw new Error('STATS_TIMEZONE geçerli bir saat dilimi olmalıdır (örn. Europe/Istanbul).');
}

module.exports = {
  isProd,
  port: parseInt(process.env.PORT, 10) || 3000,
  trustProxy: parseInt(process.env.TRUST_PROXY, 10) || (onRender ? 1 : 0),
  // Cloudflare'in eklediği CF-Connecting-IP yalnızca Cloudflare arkasında güvenilirdir (Render dahil); aksi halde taklit edilebilir
  trustCfHeaders: process.env.TRUST_CF_HEADERS ? process.env.TRUST_CF_HEADERS === 'true' : onRender,
  mongoUri: required('MONGODB_URI'),
  adminUsername,
  adminPassword,
  jwtSecret,
  sessionHours: parseInt(process.env.SESSION_HOURS, 10) || 8,
  cookieSecure: process.env.COOKIE_SECURE !== 'false',
  discordBotToken: (process.env.DISCORD_BOT_TOKEN || '').trim(),
  discordGuildId: optionalId('DISCORD_GUILD_ID'),
  discordDriverRoleId: optionalId('DISCORD_DRIVER_ROLE_ID'),
  logRetentionDays,
  statsTimezone,
  seedDemo: process.env.SEED_DEMO !== 'false',
  maxUploadBytes: 8 * 1024 * 1024,
};
