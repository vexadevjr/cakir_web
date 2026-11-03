'use strict';

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

module.exports = { normalizeIp, cleanText };
