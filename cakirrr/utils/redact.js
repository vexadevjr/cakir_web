'use strict';

const config = require('../config');

// Loglara düşebilecek sırları (anahtarlar, şifreler, veritabanı kimlik bilgisi) maskeler
function redact(input) {
  let text = input instanceof Error ? (config.isProd ? `${input.name}: ${input.message}` : input.stack || input.message) : String(input);

  const secrets = [config.discordBotToken, config.jwtSecret, config.adminPassword].filter((s) => s && s.length >= 6);
  for (const secret of secrets) text = text.split(secret).join('***');

  return text.replace(/(mongodb(?:\+srv)?:\/\/)[^@\s/]+@/gi, '$1***@');
}

function logError(label, err) {
  console.error(label, redact(err));
}

module.exports = { redact, logError };
