const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  appId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'App', 
    required: true, 
    index: true 
  },
  
  // Ruxsatlar (Granular Permissions)
  // Bu yerda foydalanuvchi qaysi ma'lumotni ilovaga berganini aniq belgilaymiz
  permissions: {
    profile: { type: Boolean, default: false },  // Ism, Familiya, Rasm
    email: { type: Boolean, default: false },
    phone: { type: Boolean, default: false },
    gender: { type: Boolean, default: false },
    dob: { type: Boolean, default: false }
  },

  status: { 
    type: String, 
    enum: ['connected', 'blocked', 'disconnected'], 
    default: 'connected',
    index: true 
  },

  isPinned: { type: Boolean, default: false, index: true },
  isSaved: { type: Boolean, default: false },
  
  // Analytics uchun (Oxirgi foydalanish vaqti)
  lastUsedAt: { type: Date, default: Date.now, index: true }
}, { 
  timestamps: true // createdAt, updatedAt
});

// --- PERFORMANCE & SECURITY INDEXES ---

// 1. UNIQUE COMPOUND INDEX: Bitta user bitta appga faqat bir marta ulanishi mumkin.
// Bu bazani ifloslanishdan saqlaydi va tezlikni oshiradi.
connectionSchema.index({ userId: 1, appId: 1 }, { unique: true });

// 2. SEARCH INDEXES: 
// "Mening ilovalarim" sahifasi uchun (Pinned apps tepada chiqishi uchun)
connectionSchema.index({ userId: 1, isPinned: -1, lastUsedAt: -1 });

// 3. STATISTICAL INDEX: Ilova uchun MAU (Monthly Active Users) hisoblash uchun
connectionSchema.index({ appId: 1, lastUsedAt: -1 });

const UserAppConnection = mongoose.model('UserAppConnection', connectionSchema);

module.exports = UserAppConnection;