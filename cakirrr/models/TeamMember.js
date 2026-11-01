'use strict';

const mongoose = require('mongoose');

const TONES = ['ceo', 'dev', 'mgmt', 'staff'];

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    role: { type: String, required: true, trim: true, maxlength: 40 },
    tone: { type: String, enum: TONES, default: 'staff' },
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

const DEFAULT_AVATAR = '/images/cakir_logo1.png';

teamSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    role: this.role,
    tone: this.tone,
    avatar: this.avatarUrl || this.fallbackAvatar || DEFAULT_AVATAR,
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

module.exports = { TeamMember: mongoose.model('TeamMember', teamSchema), TONES };
