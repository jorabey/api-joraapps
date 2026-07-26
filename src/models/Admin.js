const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  // 1. Identifikatsiya
  email: {
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  fullName: { type: String, required: true, trim: true },

  // 2. Rol asosidagi ruxsatlar (RBAC)
  // super_admin: hammasi, shu jumladan boshqa adminlarni boshqarish
  // moderator: ilovalar/shikoyatlar/foydalanuvchilarni boshqaradi, adminlarga tegmaydi
  // support: faqat ko'rish + foydalanuvchi/dasturchi bilan bog'liq cheklangan amallar
  role: {
    type: String,
    enum: ['super_admin', 'moderator', 'support'],
    default: 'moderator',
    index: true
  },

  status: {
    type: String,
    enum: ['active', 'suspended'],
    default: 'active',
    index: true
  },

  // 3. Xavfsizlik / Token Invalidation
  tokenVersion: { type: Number, default: 0 },

  // 4. Auditorlik
  lastLoginAt: { type: Date, default: null },
  lastLoginIp: { type: String, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null }
}, {
  timestamps: true
});

adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

adminSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

adminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

adminSchema.index({ email: 1, status: 1 });

const Admin = mongoose.model('Admin', adminSchema);
module.exports = Admin;
