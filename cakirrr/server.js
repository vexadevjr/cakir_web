'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { connectDB } = require('./config/db');
const { logError } = require('./utils/redact');
const { seedDefaults, seedTeam } = require('./scripts/seed');

const app = express();
const publicDir = path.join(__dirname, 'public');

app.set('trust proxy', true);

app.use((req, res, next) => {
    const userIp = req.ip || req.headers['x-forwarded-for'];
    console.log(`[ZİYARETÇİ IP] Zaman: ${new Date().toISOString()} - IP: ${userIp} - Sayfa: ${req.originalUrl}`);
    next();
});


app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', config.trustProxy);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://cdn.discordapp.com'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
// Tarayıcı özelliklerini kapatır; kullanılmayan API'ler kötüye kullanılamaz
app.use((req, res, next) => {
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  next();
});
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '20kb' }));

// Genel API hız sınırı
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/media', require('./routes/media'));
app.use('/api/team', require('./routes/team'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Kaynak bulunamadı.' }));

// Yönetim sayfası arama motorlarından gizlenir
app.use('/pages/admin.html', (req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});

// Kısa adresler
app.get('/galeri', (req, res) => res.sendFile(path.join(publicDir, 'pages', 'galeri.html')));
app.get('/admin', (req, res) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.sendFile(path.join(publicDir, 'pages', 'admin.html'));
});

// Yalnızca public klasörü servis edilir; proje kökü (.env vb.) dışarı açılmaz
app.use(express.static(publicDir, { dotfiles: 'deny', index: 'index.html', maxAge: config.isProd ? '1h' : 0 }));

app.use((req, res) => res.status(404).sendFile(path.join(publicDir, 'index.html')));

// Hata ayrıntıları istemciye sızdırılmaz
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logError('[Hata]', err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Geçersiz istek verisi.' });
  res.status(500).json({ error: 'Sunucuda bir hata oluştu.' });
});

async function start() {
  await connectDB();
  await seedDefaults().catch((err) => logError('[Seed] Atlandı:', err));
  await seedTeam().catch((err) => logError('[Seed] Kadro atlandı:', err));
  app.listen(config.port, () => console.log(`[Sunucu] http://localhost:${config.port} adresinde çalışıyor.`));
}

if (require.main === module) {
  start().catch((err) => {
    logError('[Başlatma hatası]', err);
    process.exit(1);
  });
}

module.exports = app;
