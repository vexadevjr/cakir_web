'use strict';

const { Setting } = require('../models/Media');
const discord = require('./discord');
const liveStats = require('./liveStats');
const { logError } = require('../utils/redact');

const TTL_MS = 10 * 60 * 1000; // Başarılı veri 10 dakika geçerli
const RETRY_MS = 60 * 1000; // Hata sonrası en erken 1 dakika sonra yeniden denenir

let cache = null;
let inflight = null;
let nextAttemptAt = 0;
let loadedFromDb = false;
let lastPersist = 0;

function view(data) {
  return {
    available: true,
    totalMembers: data.totalMembers,
    totalDrivers: data.totalDrivers,
    activeDrivers: data.activeDrivers,
    updatedAt: new Date(data.fetchedAt).toISOString(),
  };
}

async function refresh() {
  try {
    const data = { ...(await discord.fetchGuildStats()), fetchedAt: Date.now() };
    cache = data;
    await Setting.findOneAndUpdate({ key: 'discordStats' }, { value: data }, { upsert: true }).catch(() => {});
    return data;
  } catch (err) {
    nextAttemptAt = Date.now() + RETRY_MS;
    logError('[Discord istatistik]', err);
    throw err;
  }
}

const PERSIST_EVERY_MS = 5 * 60 * 1000;

// Canlı bağlantıdan gelen rakamları önbelleğe alır; yeniden başlatmada son değer kullanılabilsin diye veritabanına da yazar
function handleLiveUpdate(snapshot) {
  cache = snapshot;
  if (Date.now() - lastPersist < PERSIST_EVERY_MS) return;
  lastPersist = Date.now();
  Setting.findOneAndUpdate({ key: 'discordStats' }, { value: snapshot }, { upsert: true }).catch(() => {});
}

function init() {
  liveStats.start(handleLiveUpdate).catch((err) => logError('[Discord] Canlı sayım başlatılamadı:', err));
}

// İstemci istekleri Discord'a gitmez; sonuç önbellekten verilir, Discord kapalıysa son bilinen değer kullanılır
async function getStats() {
  if (!discord.statsConfigured()) return { available: false };

  // Canlı bağlantı hazırsa her zaman en güncel (çevrimiçi dahil) rakamlar kullanılır
  const live = liveStats.getSnapshot();
  if (live) return view(live);

  if (!cache && !loadedFromDb) {
    loadedFromDb = true;
    const saved = await Setting.findOne({ key: 'discordStats' }).lean().catch(() => null);
    if (saved && saved.value && saved.value.fetchedAt) cache = saved.value;
  }

  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return view(cache);
  if (Date.now() < nextAttemptAt) return cache ? view(cache) : { available: false };

  if (!inflight) inflight = refresh().finally(() => { inflight = null; });

  if (cache) {
    inflight.catch(() => {});
    return view(cache);
  }
  try {
    return view(await inflight);
  } catch {
    return { available: false };
  }
}

module.exports = { getStats, init };
