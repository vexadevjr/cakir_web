'use strict';

const config = require('../config');

const API = 'https://discord.com/api/v10';
const ID_PATTERN = /^\d{17,20}$/;

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function avatarUrl(user) {
  if (user.avatar) {
    const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=256`;
  }
  // Özel avatarı olmayan kullanıcılar için Discord'un varsayılan görseli
  const index = Number((BigInt(user.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

function isConfigured() {
  return Boolean(config.discordBotToken);
}

// Kullanıcının herkese açık Discord profilini (kullanıcı adı, görünen ad, avatar) getirir
async function fetchProfile(userId) {
  if (!isConfigured()) {
    throw httpError(503, 'DISCORD_BOT_TOKEN tanımlı değil. Anahtarı .env dosyasına ekleyin.');
  }
  if (!ID_PATTERN.test(userId)) {
    throw httpError(400, 'Discord ID yalnızca 17-20 haneli rakamlardan oluşmalıdır.');
  }

  let res;
  try {
    res = await fetch(`${API}/users/${userId}`, {
      headers: {
        Authorization: `Bot ${config.discordBotToken}`,
        'User-Agent': 'DiscordBot (https://discord.com/invite/cakircompany, 1.0)',
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw httpError(502, 'Discord’a şu an ulaşılamıyor.');
  }

  if (res.status === 404) throw httpError(404, 'Bu ID ile bir Discord kullanıcısı bulunamadı.');
  if (res.status === 401) throw httpError(502, 'Discord bot anahtarı geçersiz.');
  if (res.status === 429) throw httpError(429, 'Discord istek sınırına takıldı. Biraz sonra tekrar deneyin.');
  if (!res.ok) throw httpError(502, 'Discord profili alınamadı.');

  const user = await res.json();
  return {
    username: user.username,
    displayName: user.global_name || user.username,
    avatarUrl: avatarUrl(user),
  };
}

module.exports = { fetchProfile, isConfigured, ID_PATTERN };
