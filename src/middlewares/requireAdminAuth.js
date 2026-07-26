const jwt = require('jsonwebtoken');
const { AuthError } = require('../utils/appErrors');
const Admin = require('../models/Admin');
const config = require('../config/env');

/**
 * requireAdminAuth
 * Bearer access tokenni tekshiradi, adminni bazadan yuklaydi va
 * faol (active) ekanligini tasdiqlaydi. req.admin ga yozadi.
 */
const requireAdminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('Admin autentifikatsiyasi talab qilinadi.');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.adminSecret || config.jwt.accessSecret);

    if (decoded.role !== 'super_admin' && decoded.role !== 'moderator' && decoded.role !== 'support') {
      throw new AuthError('Bu token admin uchun yaroqli emas.');
    }

    const admin = await Admin.findById(decoded.id).select('-password').lean();
    if (!admin) {
      throw new AuthError('Admin topilmadi.');
    }

    if (admin.status !== 'active') {
      throw new AuthError('Sizning admin akkauntingiz faol emas.');
    }

    if (admin.tokenVersion !== decoded.tv) {
      throw new AuthError('Sessiya eskirgan. Iltimos, qayta login qiling.');
    }

    req.admin = admin;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AuthError('Admin seansi muddati tugadi.'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new AuthError('Noto\'g\'ri token.'));
    }
    return next(err);
  }
};

/**
 * requireRole(...roles)
 * requireAdminAuth'dan KEYIN ishlatiladi. Faqat ko'rsatilgan rollarga ruxsat beradi.
 * Masalan: requireRole('super_admin') — faqat bosh adminlar uchun.
 */
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.admin) {
    return next(new AuthError('Avval autentifikatsiyadan o\'tish kerak.'));
  }
  if (!allowedRoles.includes(req.admin.role)) {
    return next(new AuthError('Bu amal uchun sizda yetarli huquq yo\'q.'));
  }
  next();
};

module.exports = { requireAdminAuth, requireRole };
