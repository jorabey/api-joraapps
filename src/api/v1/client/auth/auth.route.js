const express = require('express');
const authController = require('./auth.controller');
const authValidation = require('./auth.validation');
const { authLimiterMiddleware, apiLimiterMiddleware } = require('../../../../middlewares/rateLimiter');

const router = express.Router();

/**
 * @route   POST /api/v1/client/auth/send-otp
 * @desc    Foydalanuvchiga xavfsiz OTP kod yuborish
 * @access  Public (Ochiq, lekin qattiq rate-limit bilan himoyalangan)
 */
router.post(
  '/send-otp',
  authLimiterMiddleware, // Soniyasiga millionlab bot hujumlarini shu yerda bo'g'amiz
  authValidation.validateSendOtp, // Email strukturasi to'g'riligini tekshirish
  authController.sendOtp
);

/**
 * @route   POST /api/v1/client/auth/register
 * @desc    Yangi foydalanuvchini OTP orqali ro'yxatdan o'tkazish
 * @access  Public
 */
router.post(
  '/register',
  authLimiterMiddleware,
  authValidation.validateRegister, // Ism, familiya, username va kuchli parol tekshiruvi
  authController.register
);

/**
 * @route   POST /api/v1/client/auth/login
 * @desc    Tizimga xavfsiz kirish (Sign-In)
 * @access  Public
 */
router.post(
  '/login',
  authLimiterMiddleware,
  authValidation.validateLogin,
  authController.login
);

/**
 * @route   POST /api/v1/client/auth/refresh
 * @desc    Access Token muddatini yangilash (Token Rotation)
 * @access  Public (Lekin faqat HttpOnly Cookie orqali ishlaydi)
 */
router.post(
  '/refresh',
  apiLimiterMiddleware, // Standart API tezlik cheklovi
  authController.rotateTokens
);

/**
 * @route   POST /api/v1/client/auth/logout
 * @desc    Tizimdan chiqish va sessiyani o'chirish
 * @access  Public
 */
router.post(
  '/logout',
  apiLimiterMiddleware,
  authController.logout
);

router.post(
  '/reset-password',
  authLimiterMiddleware,
  authValidation.validateResetPassword,
  authController.resetPassword // Hozir controllerini yozamiz
);

module.exports = router;