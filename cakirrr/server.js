'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { connectDB } = require('./config/db');
const { seedDefaults, seedTeam } = require('./scripts/seed');

const app = express();
const publicDir = path.join(__dirname, 'public');

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
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '20kb' }));

// Genel API hız sınırı
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/media', require('./routes/media'));
app.use('/api/team', require('./routes/team'));
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
  console.error('[Hata]', err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Geçersiz istek verisi.' });
  res.status(500).json({ error: 'Sunucuda bir hata oluştu.' });
});

async function start() {
  await connectDB();
  await seedDefaults().catch((err) => console.error('[Seed] Atlandı:', err.message));
  await seedTeam().catch((err) => console.error('[Seed] Kadro atlandı:', err.message));
  app.listen(config.port, () => console.log(`[Sunucu] http://localhost:${config.port} adresinde çalışıyor.`));
}

if (require.main === module) {
  start().catch((err) => {
    console.error('[Başlatma hatası]', err.message);
    process.exit(1);
  });
}

module.exports = app;
