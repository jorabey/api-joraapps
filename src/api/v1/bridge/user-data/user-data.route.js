const express = require('express');
const userDataController = require('./user-data.controller');
const verifyAppSignature = require('../../../../middlewares/verifyAppSignature');
const { apiLimiterMiddleware } = require('../../../../middlewares/rateLimiter');
const Joi = require('joi');
const { ValidationError } = require('../../../../utils/appErrors');

const router = express.Router();

// MongoDB ObjectId (24 xonali Hex string) formatini tekshirish uchun xavfsiz regex
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * ⚡ HIGH-PERFORMANCE BODY PAYLOAD VALIDATOR
 * Kiruvchi ma'lumotlarni controllerga o'tmasdan oldin xotira darajasida xavfsizlantiradi.
 */
const validateBodyPayload = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: true,   // Birinchi xatodanoq jarayonni to'xtatish (CPU tejash)
      stripUnknown: true  // Schemada bo'lmagan barcha begona parametrlarni avtomatik tozalash
    });

    if (error) {
      const cleanMessage = error.details[0].message.replace(/['"]/g, '');
      return next(new ValidationError(cleanMessage));
    }

    req.body = value; // Tozalangan va formatlangan body payloadni qayta yuklash
    next();
  };
};

// --- PAYLOAD SCHEMA DEFINITION ---
const userDataSchema = Joi.object({
  userId: Joi.string().pattern(objectIdRegex).required().messages({
    'string.pattern.base': 'So\'ralayotgan foydalanuvchi identifikatori xato (Invalid User ID format).'
  }),
  bypassCache: Joi.boolean().optional().default(false) // Keshni aylanib o'tish flagi
});

// --- GLOBAL BRIDGE API SECURITY LAYER ---
// Har bir kiruvchi so'rov tarmoq qatlamidayoq süzgichdan o'tkaziladi
router.use(apiLimiterMiddleware); // Redis orqali serverlararo flood/scraping mudofaasi (< 1ms)
router.use(verifyAppSignature);   // HMAC-SHA256 Kriptografik imzo nazorati (req.body ni o'qiydi)

// --- ROUTES DEFINITION ---

/**
 * @route   POST /api/v1/bridge/user-data
 * @desc    Tashqi faol ilova uchun foydalanuvchining ochiq ma'lumotlarini qattiq scope filtri ostida qaytarish
 * @access  Private (External Apps with valid HMAC signature)
 */
router.post(
  '/',
  validateBodyPayload(userDataSchema), // NoSQL Injection va Payload Flooding to'sig'i
  userDataController.getUserData
);

module.exports = router;