'use strict';

const config = require('../config');

const API = 'https://discord.com/api/v10';
const ID_PATTERN = /^\d{17,20}$/;
const AVATAR_HASH = /^(a_)?[0-9a-f]{16,40}$/;

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function isConfigured() {
  return Boolean(config.discordBotToken);
}

function statsConfigured() {
  return Boolean(config.discordBotToken && config.discordGuildId && config.discordDriverRoleId);
}

// Tüm Discord isteklerinin ortak çıkış noktası; hata mesajlarına anahtar asla yazılmaz
async function request(path, notFoundMessage) {
  if (!isConfigured()) {
    throw httpError(503, 'DISCORD_BOT_TOKEN tanımlı değil. Anahtarı .env dosyasına ekleyin.');
  }

  let res;
  try {
    res = await fetch(`${API}${path}`, {
      headers: {
        Authorization: `Bot ${config.discordBotToken}`,
        'User-Agent': 'DiscordBot (https://discord.com/invite/cakircompany, 1.0)',
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw httpError(502, 'Discord’a şu an ulaşılamıyor.');
  }

  if (res.status === 404) throw httpError(404, notFoundMessage || 'Discord kaynağı bulunamadı.');
  if (res.status === 401) throw httpError(502, 'Discord bot anahtarı geçersiz.');
  if (res.status === 403) throw httpError(403, 'Bot bu sunucuya erişemiyor. Botun sunucuya eklendiğinden emin olun.');
  if (res.status === 429) throw httpError(429, 'Discord istek sınırına takıldı. Biraz sonra tekrar deneyin.');
  if (!res.ok) throw httpError(502, 'Discord isteği başarısız oldu.');

  return res.json();
}

function avatarUrl(user) {
  // Yalnızca beklenen biçimdeki değerlerden CDN adresi üretilir
  if (user.avatar && AVATAR_HASH.test(user.avatar) && ID_PATTERN.test(user.id)) {
    const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=256`;
  }
  const index = Number((BigInt(user.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

// Kullanıcının herkese açık profilini (kullanıcı adı, görünen ad, avatar) getirir
async function fetchProfile(userId) {
  if (!ID_PATTERN.test(userId)) {
    throw httpError(400, 'Discord ID yalnızca 17-20 haneli rakamlardan oluşmalıdır.');
  }
  const user = await request(`/users/${userId}`, 'Bu ID ile bir Discord kullanıcısı bulunamadı.');
  if (!ID_PATTERN.test(String(user.id))) throw httpError(502, 'Discord geçersiz bir yanıt döndürdü.');
  return {
    username: String(user.username).slice(0, 64),
    displayName: String(user.global_name || user.username).slice(0, 40),
    avatarUrl: avatarUrl(user),
  };
}

// Rol başına üye sayıları; uç nokta yoksa üye listesi sayfalanarak sayılır
async function roleCounts(guildId) {
  try {
    return await request(`/guilds/${guildId}/roles/member-counts`);
  } catch (err) {
    if (err.status !== 404) throw err;
  }

  const counts = {};
  let after = '0';
  for (let page = 0; page < 50; page += 1) {
    const members = await request(`/guilds/${guildId}/members?limit=1000&after=${after}`);
    members.forEach((m) => (m.roles || []).forEach((r) => { counts[r] = (counts[r] || 0) + 1; }));
    if (members.length < 1000) break;
    after = members[members.length - 1].user.id;
  }
  return counts;
}

// Yalnızca toplu sayılar döner; hiçbir üye bilgisi dışarı çıkmaz
async function fetchGuildStats() {
  const guildId = config.discordGuildId;
  const guild = await request(`/guilds/${guildId}?with_counts=true`, 'Discord sunucusu bulunamadı.');
  const counts = await roleCounts(guildId);

  return {
    totalMembers: Number(guild.approximate_member_count) || 0,
    totalDrivers: Number(counts[config.discordDriverRoleId]) || 0,
    activeDrivers: config.discordActiveRoleId ? Number(counts[config.discordActiveRoleId]) || 0 : null,
  };
}

module.exports = { fetchProfile, fetchGuildStats, isConfigured, statsConfigured, ID_PATTERN };
