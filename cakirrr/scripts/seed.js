'use strict';

const fs = require('fs');
const path = require('path');
const { Media, Setting } = require('../models/Media');
const { TeamMember } = require('../models/TeamMember');

const DEFAULTS = [
  { title: 'Rotterdam Konvoyu', category: 'konvoy', description: 'Rotterdam çıkışlı konvoyumuzdan bir kare.' },
  { title: 'İskandinavya Sevkiyatı', category: 'konvoy', description: 'Kuzey rotasında yürüttüğümüz uzun mesafe sevkiyat.' },
  { title: 'Filo Teslimatı', category: 'filo', description: 'Şirket filosuna katılan yeni araçlarımız.' },
  { title: 'ProMods Etkinliği', category: 'etkinlik', description: 'ProMods haritasında düzenlediğimiz topluluk etkinliği.' },
];

const TEAM_DEFAULTS = [
  { name: 'Çakır', role: 'FOUNDER / CEO', color: '#ffffff', fallbackAvatar: '/images/cakir_logo1.png' },
  { name: 'Vexa', role: 'DEVELOPER', color: '#ff3333', fallbackAvatar: '/images/vexa.png' },
  { name: 'Lutzz', role: 'MANAGEMENT', color: '#5865f2', fallbackAvatar: '/images/lutz.png' },
];

// Yönetim kadrosunu mevcut üçlüyle başlatır; yönetim panelinden Discord hesaplarına bağlanabilir
async function seedTeam() {
  if (await Setting.findOne({ key: 'teamSeeded' })) return;
  if ((await TeamMember.countDocuments()) === 0) {
    await TeamMember.insertMany(TEAM_DEFAULTS.map((m, order) => ({ ...m, order })));
    console.log('[Seed] Yönetim kadrosu eklendi.');
  }
  await Setting.create({ key: 'teamSeeded', value: true });
}

// İlk kurulumda galeriyi örnek içerikle doldurur; yalnızca bir kez çalışır
async function seedDefaults() {
  if (await Setting.findOne({ key: 'gallerySeeded' })) return;

  if ((await Media.countDocuments()) === 0) {
    const file = path.join(__dirname, '..', 'public', 'images', 'cakir_banner1.jpg');
    const data = fs.readFileSync(file);
    await Media.insertMany(
      DEFAULTS.map((item, order) => ({ ...item, order, size: data.length, image: { data, contentType: 'image/jpeg' } }))
    );
    console.log('[Seed] Örnek galeri içeriği eklendi.');
  }
  await Setting.create({ key: 'gallerySeeded', value: true });
}

module.exports = { seedDefaults, seedTeam };
