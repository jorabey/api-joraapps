const express = require('express');
const analyticsController = require('./analytics.controller');
const requireDevAuth = require('../../../../middlewares/requireDevAuth');
const { apiLimiterMiddleware } = require('../../../../middlewares/rateLimiter');
const Joi = require('joi');
const { ValidationError } = require('../../../../utils/appErrors');

const router = express.Router();

// MongoDB ObjectId formatini (24 xonali Hex) qat'iy tekshirish uchun regex
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * ⚡ HIGH-PERFORMANCE PARAM VALIDATOR
 * URL tarkibidagi :appId noto'g'ri bo'lsa, so'rov controllerga o'tib o'tirmaydi.
 */
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: true,
      stripUnknown: true
    });

    if (error) {
      const cleanMessage = error.details[0].message.replace(/['"]/g, '');
      return next(new ValidationError(cleanMessage));
    }

    req.params = value;
    next();
  };
};

const appIdParamSchema = Joi.object({
  appId: Joi.string().pattern(objectIdRegex).required().messages({
    'string.pattern.base': 'Noto\'g\'ri ilova identifikatori formati (Invalid App ID).'
  })
});

// --- GLOBAL PROTECTION LAYER ---
// Tahliliy ma'lumotlar faqat tasdiqlangan dasturchilarga cheklangan limit bilan beriladi
router.use(apiLimiterMiddleware); // Redis orqali spam so'rovlarni to'sish (< 1ms)
router.use(requireDevAuth);       // JWT va Dasturchi statusini tekshirish middleware'i

// --- ROUTES DEFINITION ---

/**
 * @route   GET /api/v1/developer/analytics/overview
 * @desc    Dasturchining barcha ilovalari uchun umumlashtirilgan jonli tahlil paneli
 * @access  Private (Developer Only)
 */
router.get('/overview', analyticsController.getOverviewAnalytics);

/**
 * @route   GET /api/v1/developer/analytics/:appId
 * @desc    Alohida bitta ilova uchun batafsil MAU, DAU va yuklab olishlar tahlili
 * @access  Private (Developer Only)
 */
router.get('/:appId', validateParams(appIdParamSchema), analyticsController.getAppAnalytics);

module.exports = router;