const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
    index: true
  },
  adminEmail: { type: String, required: true }, // tezkor ko'rsatish uchun denormalizatsiya

  // Amal turi, masalan: 'app.suspend', 'developer.approve', 'user.block', 'report.resolve'
  action: { type: String, required: true, index: true },

  // Qaysi obyekt ustida amalga oshirildi
  targetType: {
    type: String,
    enum: ['App', 'Developer', 'User', 'AppReport', 'Admin', 'Bridge', 'System'],
    required: true,
    index: true
  },
  targetId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },

  // Erkin tavsif va o'zgargan qiymatlar (oldin/keyin)
  description: { type: String, default: '' },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },

  ipAddress: { type: String, default: null }
}, {
  timestamps: true
});

// Eng yangi loglarni tezkor ko'rsatish + maqsadli obyekt tarixini ko'rish
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;
