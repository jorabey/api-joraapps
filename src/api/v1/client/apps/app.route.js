const express = require('express');
const appController = require('./app.controller');
const { apiLimiterMiddleware } = require('../../../../middlewares/rateLimiter');
const Joi = require('joi');
const { ValidationError } = require('../../../../utils/appErrors');

const router = express.Router();

// --- LIGHTWEIGHT VALIDATION MIDDLEWARE FOR HIGH PERFORMANCE ---
const validateQueryParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: true,   // Birinchi xatodanoq so'rovni to'xtatish (CPU tejash)
      stripUnknown: true  // Shubhali/begona parametrlarni avtomatik tozalash
    });

    if (error) {
      const cleanMessage = error.details[0].message.replace(/['"]/g, '');
      return next(new ValidationError(cleanMessage));
    }

    req.query = value; // Tozalangan parametrlarni qayta yuklash
    next();
  };
};

// --- VALIDATION SCHEMAS ---
const getAppsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20), // Maksimal 50 ta element cheklovi
  sortBy: Joi.string().valid('mau', 'rating', 'newest').default('mau')
});

const searchAppsQuerySchema = Joi.object({
  q: Joi.string().min(1).max(100).required().trim(), // Qidiruv matni uzunligi cheklangan
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20)
});

// --- GLOBAL MIDDLEWARE FOR APPS DOMAIN ---
// Storefront API hammaga ochiq bo'lgani uchun barcha so'rovlarni birinchi bo'lib Redis limiterdan o'tkazamiz
router.use(apiLimiterMiddleware);

// --- ROUTES DEFINITION ---

/**
 * @route   GET /api/v1/client/apps
 * @desc    Ilovalar ro'yxatini reyting, MAU yoki yangiligi bo'yicha sahifalab olish
 * @access  Public
 */
router.get('/', validateQueryParams(getAppsQuerySchema), appController.getApps);

/**
 * @route   GET /api/v1/client/apps/search
 * @desc    Full-text search orqali ilovalarni qidirish
 * @access  Public
 */
router.get('/search', validateQueryParams(searchAppsQuerySchema), appController.searchApps);

/**
 * @route   GET /api/v1/client/apps/:username
 * @desc    Ilovaning barcha batafsil ma'lumotlarini username orqali yuklash
 * @access  Public
 */
router.get('/:username', appController.getAppDetails);

module.exports = router;