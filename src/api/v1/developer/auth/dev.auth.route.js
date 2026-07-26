const express = require('express');
const devAuthController = require('./dev.auth.controller');
const devAuthValidation = require('./dev.auth.validation');
const { authLimiterMiddleware, apiLimiterMiddleware } = require('../../../../middlewares/rateLimiter');

const router = express.Router();

/**
 * @route   POST /api/v1/developer/auth/register
 * @desc    Yangi dasturchini ro'yxatdan o'tkazish (Kutish 'pending' holatida)
 * @access  Public (Rate-limit bilan himoyalangan)
 */
router.post(
  '/register',
  authLimiterMiddleware,          // Botlar orqali soxta ro'yxatdan o'tishni to'sish
  devAuthValidation.validateRegister, // Kiruvchi ma'lumotlarni qat'iy tekshirish
  devAuthController.register
);

/**
 * @route   POST /api/v1/developer/auth/login
 * @desc    Dasturchi paneliga xavfsiz kirish
 * @access  Public
 */
router.post(
  '/login',
  authLimiterMiddleware,          // Brute-force (parol tanlash) hujumlaridan qat'iy himoya
  devAuthValidation.validateLogin,    // Email va parol formatini tekshirish
  devAuthController.login
);

/**
 * @route   POST /api/v1/developer/auth/refresh
 * @desc    Dasturchi Access Tokenini yangilash (Token Rotation)
 * @access  Public (Faqat xavfsiz HttpOnly Cookie orqali ishlaydi)
 */
router.post(
  '/refresh',
  apiLimiterMiddleware,           // Standart API yuklama cheklovi
  devAuthController.refreshTokens
);

/**
 * @route   POST /api/v1/developer/auth/logout
 * @desc    Dasturchi seansini tugatish va cookie'larni tozalash
 * @access  Public
 */
router.post(
  '/logout',
  apiLimiterMiddleware,
  devAuthController.logout
);

module.exports = router;