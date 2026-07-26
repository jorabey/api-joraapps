const mongoose = require('mongoose');

const appReportSchema = new mongoose.Schema({
  // Kim shikoyat qildi?
  reporterId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  
  // Qaysi ilova ustidan shikoyat?
  appId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'App', 
    required: true, 
    index: true 
  },
  
  // Shikoyat turi (Sifatli ma'lumot olish uchun Enum ishlatamiz)
  reason: { 
    type: String, 
    enum: ['spam', 'inappropriate', 'malware', 'copyright', 'fake_app', 'other'], 
    required: true,
    index: true 
  },
  
  // Batafsil ma'lumot
  description: { type: String, required: true, trim: true },
  
  // Admin boshqaruvi uchun status
  status: { 
    type: String, 
    enum: ['pending', 'investigating', 'resolved', 'rejected'], 
    default: 'pending',
    index: true 
  },
  
  // Admin qanday qaror qildi?
  adminComment: { type: String, default: null },
  resolvedAt: { type: Date, default: null }
}, { 
  timestamps: true // createdAt (shikoyat qilingan vaqt) va updatedAt
});

// --- PERFORMANCE & OPTIMIZATION ---

// 1. Adminlar uchun "Pending" shikoyatlarni eng yangisidan boshlab ko'rsatish
// Bu indeks moderatorlar dashboardi uchun juda tez ishlaydi
appReportSchema.index({ status: 1, createdAt: -1 });

// 2. Bir ilova ustidan qilingan barcha shikoyatlarni ko'rish uchun
appReportSchema.index({ appId: 1, createdAt: -1 });

const AppReport = mongoose.model('AppReport', appReportSchema);

module.exports = AppReport;