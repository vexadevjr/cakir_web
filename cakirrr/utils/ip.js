'use strict';

const net = require('net');
const config = require('../config');

// Gerçek ziyaretçi IP'si: Cloudflare arkasında CF-Connecting-IP (Cloudflare her istekte üzerine yazar, istemci taklit edemez).
// Başlık yoksa veya güvenilmiyorsa Express'in güvenilir proxy sayısına göre hesapladığı req.ip kullanılır.
function resolveClientIp(req) {
  if (config.trustCfHeaders) {
    const header = req.headers['cf-connecting-ip'];
    const value = typeof header === 'string' ? header.trim() : '';
    if (value && net.isIP(value)) return value;
  }
  return req.ip;
}

// req.ip değerini gerçek ziyaretçi IP'siyle değiştirir; hız sınırlayıcılar, ziyaret ve giriş kayıtları aynı değeri kullanır
function realIp(req, res, next) {
  const ip = resolveClientIp(req);
  Object.defineProperty(req, 'ip', { value: ip, configurable: true, enumerable: true, writable: true });
  next();
}

// IPv4 adresleri IPv6 biçiminde (::ffff:1.2.3.4) gelirse sadeleştirir
function normalizeIp(ip) {
  if (!ip) return 'bilinmiyor';
  let value = String(ip);
  if (value.startsWith('::ffff:')) value = value.slice(7);
  return value.slice(0, 64);
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
}

module.exports = { normalizeIp, cleanText, realIp };
