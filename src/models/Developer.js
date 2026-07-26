const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const developerSchema = new mongoose.Schema({
  // 1. Identifikatsiya
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true, // Qidiruv tezligi uchun
    lowercase: true, 
    trim: true 
  },
  password: { 
    type: String, 
    required: true, 
    select: false // Bazadan o'qilganda parol avtomatik chiqmasligi kerak (Security)
  },
  
  // 2. Dasturchi ma'lumotlari
  fullName: { type: String, trim: true },
  companyName: { type: String, trim: true, default: null },
  website: { type: String, trim: true },
  
  // 3. Platforma xavfsizligi va statusi
  isVerified: { 
    type: Boolean, 
    default: false, 
    index: true // Tasdiqlangan dasturchilarni tezroq saralash uchun
  },
  status: { 
    type: String, 
    enum: ['active', 'suspended', 'pending_review'], 
    default: 'pending_review',
    index: true 
  },

  // tokenVersion: refresh-token rotatsiyasi/bekor qilish uchun ishlatiladi
  // (dev.auth.controller.js token generatsiyasida ishlatadi — avval modelda
  // yo'q edi, shuning uchun har doim 0 default'ga tushib qolardi).
  tokenVersion: { type: Number, default: 0 },

  // Admin moderatsiyasi izi
  moderation: {
    suspendedReason: { type: String, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    reviewedAt: { type: Date, default: null }
  },
  
  // 4. Auditorlik
  lastLogin: { type: Date, default: Date.now }
}, { 
  timestamps: true 
});

// Middleware: Parolni hashlash
developerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  // Cost factor 12: Brute-force hujumlaridan himoya qilish uchun
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Metod: Parolni tekshirish
developerSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Security: JSON javobdan parolni butunlay o'chirish
developerSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

// Indexing for high-scale performance
developerSchema.index({ email: 1, status: 1 });

const Developer = mongoose.model('Developer', developerSchema);

module.exports = Developer;