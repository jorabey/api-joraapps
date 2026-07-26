const express = require('express');
const myAppsController = require('./my-apps.controller');
const myAppsValidation = require('./my-apps.validation');
const requireDevAuth = require('../../../../middlewares/requireDevAuth');
const { apiLimiterMiddleware } = require('../../../../middlewares/rateLimiter');

const router = express.Router();

/**
 * 🔐 GLOBAL PROTECTION LAYER
 * Ushbu ruter ichidagi barcha endpointlarni qattiq nazorat ostiga olamiz.
 * 1. apiLimiterMiddleware -> Redis orqali spam/DDoS hujumlarini to'sadi (< 1ms).
 * 2. requireDevAuth -> Faqat tizimdan o'tgan faol dasturchilarga ruxsat beradi.
 */
router.use(apiLimiterMiddleware);
router.use(requireDevAuth);

/**
 * @route   POST /api/v1/developer/my-apps
 * @desc    Yangi ilova qo'shish (Moderatorlar tekshiruviga yuborish)
 * @access  Private (Developer only)
 */
router.post(
  '/',
  myAppsValidation.validateCreateApp, // Payload strukturasi va XSS elementlarini tekshirish
  myAppsController.createApp
);

/**
 * @route   GET /api/v1/developer/my-apps
 * @desc    Dasturchining barcha ilovalari ro'yxatini sahifalab yuklash (Pagination)
 * @access  Private (Developer only)
 */
router.get(
  '/',
  myAppsValidation.validateGetMyApps, // page va limit parametrlarini white-list qilish
  myAppsController.getMyApps
);

/**
 * @route   PATCH /api/v1/developer/my-apps/:id
 * @desc    Ilova metama'lumotlarini qisman tahrirlash (Keshni tozalash mexanizmi bilan)
 * @access  Private (Developer only)
 */
router.patch(
  '/:id',
  myAppsValidation.validateAppIdAndPayload, // URL parametridagi :id (ObjectId) va body'ni tekshirish
  myAppsController.updateApp
);

/**
 * @route   DELETE /api/v1/developer/my-apps/:id
 * @desc    Ilovani butunlay o'chirish va unga bog'liq barcha API kalitlarni keshdan o'chirish
 * @access  Private (Developer only)
 */
router.delete(
  '/:id',
  myAppsValidation.validateAppId, // Faqat to'g'ri ObjectId formatini o'tkazish
  myAppsController.deleteApp
);

module.exports = router;