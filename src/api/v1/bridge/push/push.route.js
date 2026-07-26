const express = require('express');
const pushController = require('./push.controller');
const verifyAppSignature = require('../../../../middlewares/verifyAppSignature');
const { apiLimiterMiddleware } = require('../../../../middlewares/rateLimiter');
const Joi = require('joi');
const { ValidationError } = require('../../../../utils/appErrors');

const router = express.Router();

// MongoDB ObjectId formatini qat'iy tekshirish uchun xavfsiz regulyar ifoda
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * ⚡ HIGH-PERFORMANCE LIGHTWEIGHT PAYLOAD VALIDATOR
 * Kiruvchi push xabar tarkibini Controller qatlamiga o'tishidan oldin tozalaydi.
 */
const validatePushPayload = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: true,   // Birinchi xatodanoq tekshirishni to'xtatish (CPU tejash)
      stripUnknown: true  // Payload tarkibidagi barcha begona maydonlarni qirqib tashlash
    });

    if (error) {
      const cleanMessage = error.details[0].message.replace(/['"]/g, '');
      return next(new ValidationError(cleanMessage));
    }

    req.body = value;
    next();
  };
};

// --- PUSH SCHEMAS DEFINITION ---
const pushPayloadSchema = Joi.object({
  userId: Joi.string().pattern(objectIdRegex).required().messages({
    'string.pattern.base': 'Noto\'g\'ri maqsadli foydalanuvchi identifikatori (Invalid Target User ID).'
  }),
  title: Joi.string().min(1).max(100).required().trim(),
  body: Joi.string().min(1).max(500).required().trim(),
  url: Joi.string().uri().max(255).allow('').optional().trim() // Push bosilganda ochiladigan havola
});

// --- GLOBAL BRIDGE API PROTECTION LAYER ---
// Tashqi tizimlar so'rovlar oqimini tartibga solish va xavfsizlik filtrlari
router.use(apiLimiterMiddleware);   // Redis orqali server-to-server spam to'sig'i (< 1ms)
router.use(verifyAppSignature);     // Cryptographic HMAC-SHA256 Signature Verification

// --- ROUTES DEFINITION ---

/**
 * @route   POST /api/v1/bridge/push
 * @desc    Tashqi faol ilova tomonidan foydalanuvchiga push bildirishnoma yuborish
 * @access  Private (External Apps with valid cryptographic signature)
 */
router.post(
  '/',
  validatePushPayload(pushPayloadSchema), // Ma'lumotlar xavfsizligi va format nazorati
  pushController.sendPush
);

module.exports = router;