const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // 1. Identifikatsiya (Unikal indekslar qidiruv tezligini ta'minlaydi)
  username: { type: String, required: true, unique: true, index: true, trim: true, minlength: 3 },
  email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  phone: { type: String, index: true, trim: true },

  // 2. Maxfiylik (Password select: false - xavfsizlik uchun)
  password: { type: String, required: true, select: false },

  // 3. Profil ma'lumotlari
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  dob: { type: Date }, // Tug'ilgan sana
  country: { type: String, default: 'UZ' },
  language: { type: String, default: 'uz' },
  avatarUrl: { type: String, default: null },

  // 4. Holat va Xavfsizlik bayroqlari
  isBlocked: { type: Boolean, default: false, index: true },
  accountStatus: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active' },
  lastOnline: { type: Date, default: Date.now },

  // Admin moderatsiyasi izi
  moderation: {
    blockedReason: { type: String, default: null },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    blockedAt: { type: Date, default: null }
  },
  
  // 5. Preferensiyalar
  privacySettings: {
    showEmail: { type: Boolean, default: false },
    showPhone: { type: Boolean, default: false },
    allowDataSharing: { type: Boolean, default: true }
  }
}, { 
  timestamps: true, // createdAt va updatedAt avtomatik
  toJSON: { virtuals: true }, 
  toObject: { virtuals: true } 
});


// Virtual maydon: To'liq ism (bazada joy egallamaydi, tez)
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Middleware: Parolni hashlash (Security)
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12); // 12-round xavfsizlik uchun optimal
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Metod: Parolni tekshirish
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Security: JSON javobdan password va ichki bayroqlarni olib tashlash
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

// Compound Index: Qidiruv va saralash uchun (Pagination uchun juda muhim)
userSchema.index({ createdAt: -1 });
userSchema.index({ username: 1, email: 1 });

const User = mongoose.model('User', userSchema);
module.exports = User;