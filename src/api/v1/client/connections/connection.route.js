const express = require('express');
const connectionController = require('./connection.controller');
const requireAuth = require('../../../../middlewares/requireAuth');
const { apiLimiterMiddleware } = require('../../../../middlewares/rateLimiter');
const Joi = require('joi');
const { ValidationError } = require('../../../../utils/appErrors');

const router = express.Router();

// MongoDB ObjectId formatini tekshirish uchun xavfsiz regulyar ifoda
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// --- HIGH-PERFORMANCE VALIDATION RUNNER ---
const validatePayload = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: true,   // Birinchi xatodanoq jarayonni to'xtatib, CPU sikllarini tejaydi
      stripUnknown: true  // Shubhali va ortiqcha parametrlarni filtr darajasida o'chiradi
    });

    if (error) {
      const cleanMessage = error.details[0].message.replace(/['"]/g, '');
      return next(new ValidationError(cleanMessage));
    }

    req[property] = value;
    next();
  };
};

// --- JOI SCHEMAS ---
const connectAppSchema = Joi.object({
  appId: Joi.string().pattern(objectIdRegex).required().messages({
    'string.pattern.base': 'Noto\'g\'ri ilova identifikatori (Invalid appId).'
  }),
  scopes: Joi.array().items(Joi.string().max(50)).unique().max(20).default([])
});

const disconnectAppSchema = Joi.object({
  appId: Joi.string().pattern(objectIdRegex).required()
});

const getConnectedAppsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20)
});

const checkConnectionSchema = Joi.object({
  userId: Joi.string().pattern(objectIdRegex).required(),
  appId: Joi.string().pattern(objectIdRegex).required()
});

const blockAppSchema = Joi.object({
  appId: Joi.string().pattern(objectIdRegex).required()
});

const unblockAppSchema = Joi.object({
  appId: Joi.string().pattern(objectIdRegex).required()
});

const reportAppSchema = Joi.object({
  appId: Joi.string().pattern(objectIdRegex).required(),
  reason: Joi.string().valid('spam', 'inappropriate', 'malware', 'copyright', 'fake_app', 'other').required(),
  description: Joi.string().min(3).max(1000).required()
});

// --- GLOBAL SECURITY & RATE LIMITING LAYER ---
// Ushbu domendagi barcha endpointlar majburiy ravishda xavfsizlik süzgichlaridan o'tadi
router.use(apiLimiterMiddleware); // Redis asosidagi global spam to'sig'i (< 1ms)
router.use(requireAuth);          // Access Token validation va faol sessiya nazorati

// --- ROUTES DEFINITION ---

/**
 * @route   POST /api/v1/client/connections
 * @desc    Ilovaga yangi ruxsatlar berish yoki o'rnatish (Connect)
 * @access  Private
 */
router.post('/', validatePayload(connectAppSchema, 'body'), connectionController.connectApp);

/**
 * @route   POST /api/v1/client/connections/disconnect
 * @desc    Ilovani o'chirish va ruxsatnomalarini bekor qilish (Disconnect)
 * @access  Private
 */
router.post('/disconnect', validatePayload(disconnectAppSchema, 'body'), connectionController.disconnectApp);

/**
 * @route   GET /api/v1/client/connections
 * @desc    Foydalanuvchining barcha faol ulangan ilovalari ro'yxatini olish
 * @access  Private
 */
router.get('/', validatePayload(getConnectedAppsSchema, 'query'), connectionController.getMyConnectedApps);

/**
 * @route   GET /api/v1/client/connections/check
 * @desc    Ilova va foydalanuvchi o'rtasidagi aloqa va scope'larni tekshirish (Internal/Bridge optimized)
 * @access  Private
 */
router.get('/check', validatePayload(checkConnectionSchema, 'query'), connectionController.checkConnection);

/**
 * @route   POST /api/v1/client/connections/block
 * @desc    Ilovani bloklash (foydalanuvchi tomonidan)
 * @access  Private
 */
router.post('/block', validatePayload(blockAppSchema, 'body'), connectionController.blockApp);

/**
 * @route   POST /api/v1/client/connections/unblock
 * @desc    Ilovani blokdan chiqarish
 * @access  Private
 */
router.post('/unblock', validatePayload(unblockAppSchema, 'body'), connectionController.unblockApp);

/**
 * @route   POST /api/v1/client/connections/report
 * @desc    Ilova ustidan shikoyat yuborish (admin moderatsiyasiga tushadi)
 * @access  Private
 */
router.post('/report', validatePayload(reportAppSchema, 'body'), connectionController.reportApp);

module.exports = router;