const AuditLog = require('../models/AuditLog');

/**
 * logAdminAction
 * Har bir admin amalini AuditLog kolleksiyasiga yozadi. Asosiy so'rov
 * oqimini sekinlashtirmaslik uchun await qilinmaydi (fire-and-forget),
 * lekin xatolik bo'lsa konsolga chiqariladi — jim yutilmaydi.
 */
const logAdminAction = ({ admin, action, targetType, targetId = null, description = '', meta = {}, ipAddress = null }) => {
  AuditLog.create({
    adminId: admin._id,
    adminEmail: admin.email,
    action,
    targetType,
    targetId,
    description,
    meta,
    ipAddress
  }).catch((err) => {
    console.error('⚠️ Audit log yozishda xatolik:', err.message);
  });
};

module.exports = { logAdminAction };
