const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const appSchema = new mongoose.Schema({
  // 1. Asosiy identifikatorlar
  developerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Developer', 
    required: true, 
    index: true 
  },
  username: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true, // Qidiruv uchun juda muhim
    lowercase: true, 
    trim: true 
  },
  name: { type: String, required: true, trim: true, index: true },
  description: { type: String, required: true },

  // Admin tomonidan tasniflash uchun kategoriya (moderatsiya/katalog filtri)
  category: {
    type: String,
    enum: ['games', 'finance', 'social', 'productivity', 'shopping', 'education', 'entertainment', 'utilities', 'other'],
    default: 'other',
    index: true
  },
  
  // 2. Texnik ma'lumotlar
  appUrl: { type: String, required: true }, // Ilova joylashgan manzil
  iconUrl: { type: String, required: true },
  
  // 3. API Xavfsizlik (Muhim!)
  appToken: { type: String, required: true, unique: true }, // Ochiq ID
  appSecret: { type: String, required: true, select: false }, // Maxfiy kalit (hashlangan)
  
  // 4. Status va tasdiqlash
  status: { 
    type: String, 
    enum: ['under_review', 'live', 'suspended'], 
    default: 'under_review',
    index: true 
  },
  isVerified: { type: Boolean, default: false, index: true }, // Platforma tasdig'i

  // Admin moderatsiyasi izi (audit uchun denormalizatsiya — tezkor ko'rsatish)
  moderation: {
    suspendedReason: { type: String, default: null },
    rejectedReason: { type: String, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    reviewedAt: { type: Date, default: null }
  },
  
  // 5. Statistika va Rating (Optimallashtirilgan)
  stats: {
    mau: { type: Number, default: 0 }, // Monthly Active Users
    totalConnections: { type: Number, default: 0 }
  },
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  }
}, { 
  timestamps: true 
});

// --- SECURITY: Hashing logic ---

// Metod: Secret ni tekshirish
appSchema.methods.verifySecret = async function(enteredSecret) {
  return await bcrypt.compare(enteredSecret, this.appSecret);
};

// --- PERFORMANCE: Indexes ---

// 1. Text Index (Search uchun - juda tez qidiruv)
appSchema.index({ name: 'text', description: 'text', username: 'text' });

// 2. Ranking Index (Storeda eng zo'r ilovalarni chiqarish uchun)
appSchema.index({ isVerified: -1, 'rating.average': -1, 'stats.mau': -1 });

// 3. Developer App list uchun
appSchema.index({ developerId: 1, status: 1 });

const App = mongoose.model('App', appSchema);
module.exports = App;