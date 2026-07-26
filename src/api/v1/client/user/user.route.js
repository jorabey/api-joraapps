const express = require('express');
const userController = require('./user.controller');
const requireAuth = require('../../../../middlewares/requireAuth');
const { apiLimiterMiddleware } = require('../../../../middlewares/rateLimiter');

const router = express.Router();

/**
 * 🔐 GLOBAL PROTECTION LAYER
 * Ushbu ruter ichidagi barcha yo'nalishlar (routes) uchun autentifikatsiyani majburiy qilamiz.
 * Dasturchi xatoligi tufayli biror endpoint ochiq qolib ketish xavfi nolga tushadi.
 */
router.use(apiLimiterMiddleware); // Spam va DDoS hujumlaridan himoya (< 1ms Redis)
router.use(requireAuth);          // JWT validation va Stateful block-list tekshiruvi

/**
 * @route   GET /api/v1/client/users/me
 * @desc    Joriy foydalanuvchi profilini yuklash
 * @access  Private
 */
router.get('/me', userController.getMe);

/**
 * @route   PATCH /api/v1/client/users/me
 * @desc    Profil ma'lumotlarini qisman yangilash (White-listed update)
 * @access  Private
 */
router.patch('/me', userController.updateMe);

/**
 * @route   PUT /api/v1/client/users/password
 * @desc    Parolni yangilash va boshqa barcha sessiyalarni invalidatsiya qilish
 * @access  Private
 */
router.put('/password', userController.updatePassword);

/**
 * @route   GET /api/v1/client/users/sessions
 * @desc    Foydalanuvchining barcha faol qurilmalar ro'yxatini ko'rish
 * @access  Private
 */
router.get('/sessions', userController.getMySessions);

/**
 * @route   DELETE /api/v1/client/users/sessions/other
 * @desc    Joriy qurilmadan tashqari barcha seanslarni tugatish (Kill all sessions)
 * @access  Private
 */
router.post('/sessions/other', userController.terminateOtherSessions);

module.exports = router;