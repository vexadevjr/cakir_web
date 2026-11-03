'use strict';

const { Client, GatewayIntentBits, Events } = require('discord.js');
const config = require('../config');
const { logError } = require('../utils/redact');

const RECOUNT_DELAY_MS = 3000; // Çok sayıda olay gelirse sayım tek seferde yapılır
const RETRY_MS = 10 * 60 * 1000; // Bağlantı kurulamazsa 10 dakikada bir yeniden denenir

let client = null;
let snapshot = null;
let recountTimer = null;
let onUpdate = null;

function isActive(member) {
  const status = member.presence && member.presence.status;
  return status === 'online' || status === 'idle' || status === 'dnd';
}

// Sunucu önbelleğinden toplu rakamları hesaplar; kişisel bilgi döndürmez
function summarize(guild, driverRoleId) {
  const drivers = guild.members.cache.filter((m) => m.roles.cache.has(driverRoleId));
  return {
    totalMembers: guild.memberCount,
    totalDrivers: drivers.size,
    activeDrivers: drivers.filter(isActive).size,
  };
}

function recount() {
  const guild = client && client.guilds.cache.get(config.discordGuildId);
  if (!guild) return;
  snapshot = { ...summarize(guild, config.discordDriverRoleId), fetchedAt: Date.now() };
  if (onUpdate) onUpdate(snapshot);
}

function scheduleRecount() {
  if (recountTimer) return;
  recountTimer = setTimeout(() => {
    recountTimer = null;
    recount();
  }, RECOUNT_DELAY_MS);
  recountTimer.unref();
}

async function connect() {
  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences],
  });

  client.on(Events.Error, (err) => logError('[Discord gateway]', err));
  [Events.PresenceUpdate, Events.GuildMemberAdd, Events.GuildMemberRemove, Events.GuildMemberUpdate].forEach((event) =>
    client.on(event, scheduleRecount)
  );

  client.once(Events.ClientReady, async () => {
    try {
      const guild = await client.guilds.fetch(config.discordGuildId);
      await guild.members.fetch({ withPresences: true });
      if (!guild.roles.cache.has(config.discordDriverRoleId)) {
        console.warn('[Discord] DISCORD_DRIVER_ROLE_ID sunucuda bulunamadı; rol ID’sini kontrol edin.');
      }
      recount();
      console.log('[Discord] Canlı sürücü sayımı aktif.');
    } catch (err) {
      logError('[Discord] Üyeler alınamadı:', err);
    }
  });

  await client.login(config.discordBotToken);
}

function describeFailure(err) {
  if (/disallowed intents/i.test(err.message)) {
    return 'Discord Developer Portal > Bot bölümünde "Server Members Intent" ve "Presence Intent" seçeneklerini açın.';
  }
  return null;
}

async function start(callback) {
  if (!config.discordBotToken || !config.discordGuildId || !config.discordDriverRoleId) return;
  onUpdate = callback;

  try {
    await connect();
  } catch (err) {
    logError('[Discord] Canlı bağlantı kurulamadı:', err);
    const hint = describeFailure(err);
    if (hint) console.error(`[Discord] İpucu: ${hint}`);
    if (client) await client.destroy().catch(() => {});
    client = null;
    setTimeout(() => start(callback), RETRY_MS).unref();
  }
}

// Bağlantı hazır değilse null döner; çağıran taraf yedek yönteme geçer
function getSnapshot() {
  return client && client.isReady() ? snapshot : null;
}

module.exports = { start, getSnapshot, summarize };
