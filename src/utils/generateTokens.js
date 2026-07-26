const jwt = require('jsonwebtoken');
const config = require('../config/env');
const crypto = require('crypto');

/**
 * Access Token: Juda qisqa muddatli (15 daqiqa)
 * Tezkor so'rovlarni autentifikatsiya qilish uchun.
 */
// generateTokens.js
const generateAccessToken = (user, sessionJti) => {
  return jwt.sign(
    { 
      id: user._id, 
      role: user.role || 'user',
      sId: sessionJti // <-- Sessiya ID'sini Access Tokenga ham qo'shdik
    },
    config.jwt.accessSecret, 
    { expiresIn: '15m' }     
  );
};

/**
 * Refresh Token: Uzoq muddatli (7 kun)
 * Yangi Access Token olish uchun ishlatiladi.
 * * "tokenVersion" - bu eng muhim narsa! Agar user parolini o'zgartirsa 
 * yoki "Barcha qurilmalardan chiqish" tugmasini bossa, 
 * bazadagi tokenVersion ni oshiramiz va barcha eski Refresh Tokenlar 
 * darhol ishlamay qoladi (Invalidation).
 */

const generateRefreshToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      jti: crypto.randomUUID() // Har bir token uchun unikal ID
    },
    config.jwt.refreshSecret, 
    { expiresIn: '7d' } 
  );
};

/**
 * Admin Access Token: 15 daqiqa muddatli, role va tokenVersion (tv) bilan.
 * tv orqali "barcha sessiyalardan chiqarish" (masalan, parol almashtirilganda
 * yoki admin suspend qilinganda) bir zumda amalga oshiriladi.
 */
const generateAdminAccessToken = (admin) => {
  return jwt.sign(
    {
      id: admin._id,
      role: admin.role,
      tv: admin.tokenVersion || 0
    },
    config.jwt.adminSecret || config.jwt.accessSecret,
    { expiresIn: '15m' }
  );
};

/**
 * Admin Refresh Token: 7 kun muddatli.
 */
const generateAdminRefreshToken = (admin) => {
  return jwt.sign(
    {
      id: admin._id,
      tv: admin.tokenVersion || 0
    },
    config.jwt.refreshSecret,
    { expiresIn: '7d' }
  );
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateAdminAccessToken,
  generateAdminRefreshToken
};