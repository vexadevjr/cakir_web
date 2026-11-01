'use strict';

const mongoose = require('mongoose');

const CATEGORIES = ['genel', 'konvoy', 'etkinlik', 'filo'];

const mediaSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    category: { type: String, enum: CATEGORIES, default: 'genel' },
    order: { type: Number, default: 0, index: true },
    size: { type: Number, default: 0 },
    // Görsel ikili verisi sorgularda varsayılan olarak dışarıda tutulur
    image: {
      data: { type: Buffer, required: true, select: false },
      contentType: { type: String, required: true },
    },
  },
  { timestamps: true }
);

// Sıralı listeleme için bileşik indeks
mediaSchema.index({ order: 1, createdAt: 1 });

mediaSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    title: this.title,
    description: this.description,
    category: this.category,
    order: this.order,
    size: this.size,
    createdAt: this.createdAt,
    url: `/api/media/${this._id}/image`,
  };
};

const Setting = mongoose.model(
  'Setting',
  new mongoose.Schema({ key: { type: String, unique: true }, value: mongoose.Schema.Types.Mixed })
);

module.exports = { Media: mongoose.model('Media', mediaSchema), Setting, CATEGORIES };
