const mongoose = require('mongoose');

const otpBlockSchema = new mongoose.Schema({
  // Bloklangan foydalanuvchi identifikatori (email yoki telefon raqami)
  key: { 
    type: String, 
    required: true, 
    index: true 
  },
  
  // Qaysi turdagi amal uchun bloklangan (Login, Ro'yxatdan o'tish, Parolni tiklash)
  type: { 
    type: String, 
    required: true, 
    enum: ['auth', 'registration', 'reset_password'],
    index: true 
  },
  
  // Bloklash sababi (masalan: 'too_many_attempts')
  reason: { type: String, default: 'too_many_attempts' },
  
  // TTL (Time-To-Live) indeksi: MongoDB buni avtomatik o'chiradi
  // Bu milliardlab userda bazani tozalashni avtomatlashtiradi
  expiresAt: { 
    type: Date, 
    required: true,
    index: { expires: 0 } 
  }
}, { 
  timestamps: true 
});

// Compound Index: Bitta user bitta turdagi amal uchun bir vaqtda 
// bir nechta blokga ega bo'lmasligi kerak (High performance search)
otpBlockSchema.index({ key: 1, type: 1 }, { unique: true });

const OtpBlock = mongoose.model('OtpBlock', otpBlockSchema);

module.exports = OtpBlock;