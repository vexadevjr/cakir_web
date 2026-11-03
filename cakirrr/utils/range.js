'use strict';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

function parts(date, tz) {
  const out = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).forEach((p) => { out[p.type] = p.value; });
  return { y: +out.year, m: +out.month, d: +out.day, h: +out.hour, min: +out.minute, s: +out.second };
}

function offsetMs(date, tz) {
  const p = parts(date, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}

// Verilen saat diliminde yerel gün başlangıcının UTC karşılığı
function localMidnight(y, m, d, tz) {
  const guess = Date.UTC(y, m - 1, d);
  return new Date(guess - offsetMs(new Date(guess), tz));
}

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (p) => `${p.y}-${pad(p.m)}-${pad(p.d)}`;

// Grafik aralığı: başlangıç anı, MongoDB gruplama biçimi ve (boşlukları sıfırla doldurmak için) tüm kova anahtarları
function buildRange(range, now, tz) {
  const keys = [];
  const push = (k) => { if (keys[keys.length - 1] !== k) keys.push(k); };

  if (range === 'day') {
    for (let i = 23; i >= 0; i -= 1) {
      const p = parts(new Date(now.getTime() - i * HOUR), tz);
      push(`${dayKey(p)} ${pad(p.h)}`);
    }
    const start = new Date(Math.floor(now.getTime() / HOUR) * HOUR - 23 * HOUR);
    return { range, unit: 'hour', format: '%Y-%m-%d %H', start, keys };
  }

  if (range === 'week' || range === 'month') {
    const n = range === 'week' ? 7 : 30;
    for (let i = n - 1; i >= 0; i -= 1) push(dayKey(parts(new Date(now.getTime() - i * DAY), tz)));
    const [y, m, d] = keys[0].split('-').map(Number);
    return { range, unit: 'day', format: '%Y-%m-%d', start: localMidnight(y, m, d, tz), keys };
  }

  // year: son 12 ay
  const p = parts(now, tz);
  for (let i = 11; i >= 0; i -= 1) {
    const idx = p.y * 12 + (p.m - 1) - i;
    keys.push(`${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`);
  }
  const [y, m] = keys[0].split('-').map(Number);
  return { range: 'year', unit: 'month', format: '%Y-%m', start: localMidnight(y, m, 1, tz), keys };
}

module.exports = { buildRange };
