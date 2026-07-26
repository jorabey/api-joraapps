const express = require('express');
const apiKeysController = require('./api-keys.controller');
const requireDevAuth = require('../../../../middlewares/requireDevAuth');
const { apiLimiterMiddleware } = require('../../../../middlewares/rateLimiter');
const Joi = require('joi');
const { ValidationError } = require('../../../../utils/appErrors');

const router = express.Router();

// MongoDB ObjectId formatini (24 xonali Hex) qat'iy tekshirish uchun regex
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * ⚡ ULTRA-FAST PARAMETER VALIDATOR
 * URL tarkibidagi :appId noto'g'ri bo'lsa, jarayonni shu zaxoti to'xtatadi.
 */
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: true,   // Birinchi xatodanoq to'xtash (CPU sikllarini tejash)
      stripUnknown: true  // Shubhali/ortiqcha parametrlarni avtomatik o'chirish
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
// API kalitlari bilan ishlovchi har bir endpoint qat'iy himoya ostiga olinadi
router.use(apiLimiterMiddleware); // Redis asosidagi spam va brute-force to'sig'i (< 1ms)
router.use(requireDevAuth);       // Faqat tizimdan muvaffaqiyatli o'tgan faol dasturchilarga ruxsat berish

// --- ROUTES DEFINITION ---

/**
 * @route   GET /api/v1/developer/api-keys/:appId
 * @desc    Ilovaning maxfiy App Token va App Secret kalitlarini xavfsiz yuklash
 * @access  Private (Developer Only)
 */
router.get('/:appId', validateParams(appIdParamSchema), apiKeysController.getApiKeys);

/**
 * @route   POST /api/v1/developer/api-keys/:appId/regenerate
 * @desc    API kalitlarini rotatsiya qilish (Yangilash va eski barcha keshni o'chirish)
 * @access  Private (Developer Only)
 */
router.post('/:appId/regenerate', validateParams(appIdParamSchema), apiKeysController.regenerateApiKeys);

module.exports = router;