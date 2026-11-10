'use strict';

const mongoose = require('mongoose');

const TONES = ['ceo', 'dev', 'mgmt', 'staff'];

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    role: { type: String, required: true, trim: true, maxlength: 40 },
    // Eski kayıtlar için; yeni kayıtlarda renk doğrudan `color` alanında tutulur
    tone: { type: String, enum: TONES },
    color: { type: String, match: /^#[0-9a-fA-F]{6}$/ },
    order: { type: Number, default: 0, index: true },
    // Discord'dan çekilen bilgiler
    discordId: { type: String, match: /^\d{17,20}$/, index: { unique: true, sparse: true } },
    discordUsername: { type: String, maxlength: 64 },
    avatarUrl: { type: String, maxlength: 300 },
    syncedAt: { type: Date },
    // Discord bağlı değilse kullanılacak yerel görsel
    fallbackAvatar: { type: String, maxlength: 200 },
  },
  { timestamps: true }
);

const DEFAULT_AVATAR = '/images/cakir_logo1.webp';
// Veritabanında eski kayıtlarda kalmış yerel .png yollarını .webp karşılığına çevirir
const LEGACY_LOCAL_AVATAR = /^(\/images\/(?:cakir_logo1|vexa|lutz))\.png$/;
const modernAvatar = (url) => (typeof url === 'string' ? url.replace(LEGACY_LOCAL_AVATAR, '$1.webp') : url);
const DEFAULT_COLOR = '#9aa1a9';
const TONE_COLORS = { ceo: '#ffffff', dev: '#ff3333', mgmt: '#5865f2', staff: DEFAULT_COLOR };
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

teamSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    role: this.role,
    color: this.color || TONE_COLORS[this.tone] || DEFAULT_COLOR,
    avatar: this.avatarUrl || modernAvatar(this.fallbackAvatar) || DEFAULT_AVATAR,
  };
};

teamSchema.methods.toAdmin = function toAdmin() {
  return {
    ...this.toPublic(),
    discordId: this.discordId || '',
    discordUsername: this.discordUsername || '',
    syncedAt: this.syncedAt || null,
  };
};

module.exports = { TeamMember: mongoose.model('TeamMember', teamSchema), TONES, HEX_COLOR, DEFAULT_COLOR };
