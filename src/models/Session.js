const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true // Userning barcha sessiyalarini tez topish uchun
  },
  
  // XAVFSIZLIK: Tokenni ochiq holda saqlamang. Hashlab saqlash tavsiya etiladi.
  tokenHash: { type: String, required: true, index: true }, 

  // QURILMA MA'LUMOTLARI (Anomaly detection uchun)
  deviceInfo: {
    osName: { type: String },      // iOS, Android, Windows
    osVersion: { type: String },
    browser: { type: String },
    deviceType: { type: String },  // Mobile, Desktop, Tablet
    ipAddress: { type: String, required: true },
    location: {
      country: { type: String },
      city: { type: String },
      isp: { type: String }
    }
  },

  // HOLAT
  isRevoked: { type: Boolean, default: false }, // Foydalanuvchi "Logout" qilsa
  lastActive: { type: Date, default: Date.now, index: true },
  
  // TTL (Time To Live) uchun
  expiresAt: { 
    type: Date, 
    required: true,
    index: { expires: 0 } // MongoDB ushbu vaqt kelganda hujjatni o'zi o'chiradi
  }
}, { 
  timestamps: true 
});

// --- PERFORMANCE: Compound Indexes ---

// 1. Sessionni tekshirishda tezkor qidiruv (userId + token)
sessionSchema.index({ userId: 1, isRevoked: 1 });

// 2. "Barcha qurilmalardan chiqish" (Logout all) funksiyasi uchun
sessionSchema.index({ userId: 1, lastActive: -1 });

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;