const express = require('express');
const eventLogsController = require('./event-logs.controller');
const verifyAppSignature = require('../../../../middlewares/verifyAppSignature');
const { apiLimiterMiddleware } = require('../../../../middlewares/rateLimiter');
const Joi = require('joi');
const { ValidationError } = require('../../../../utils/appErrors');

const router = express.Router();

// MongoDB ObjectId formatini qat'iy tekshirish uchun xavfsiz regex
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * ⚡ LIGHTWEIGHT BATCH VALIDATOR
 * Kiruvchi ma'lumotlar hajmini controllerga yetmasdan oldin xotira darajasida cheklaydi.
 */
const validateEventPayload = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: true,   // Birinchi xatodanoq tekshirishni to'xtatish (CPU sikllarini tejash)
      stripUnknown: true  // Payload tarkibidagi barcha begona maydonlarni tozalash
    });

    if (error) {
      const cleanMessage = error.details[0].message.replace(/['"]/g, '');
      return next(new ValidationError(cleanMessage));
    }

    req.body = value;
    next();
  };
};

// --- EVENT LOGS SCHEMA DEFINITION ---
const eventLogPayloadSchema = Joi.object({
  userId: Joi.string().pattern(objectIdRegex).required().messages({
    'string.pattern.base': 'Noto\'g\'ri foydalanuvchi identifikatori (Invalid User ID format).'
  }),
  eventType: Joi.string().min(2).max(50).required().trim().lowercase(), // Masalan: 'click_buy_button', 'page_view'
  
  /**
   * 🔐 DOS huxumidan himoya: metadata obyekti ichidagi kalitlar sonini maksimal 20 taga cheklaymiz.
   * Bu xakerlarning megabaytlab soxta JSON ma'lumotlar yuborib Node.js xotirasini (RAM) to'ldirishini to'sadi.
   */
  metadata: Joi.object().max(20).unknown(true).optional().default({})
});

// --- GLOBAL BRIDGE API SECURITY LAYER ---
// Telemetriya oqimi juda katta bo'lgani uchun tarmoq kirishini Redis himoya qalqonlari bilan o'rab olamiz
router.use(apiLimiterMiddleware);   // Redis orqali server-to-server spam to'sig'i (< 1ms)
router.use(verifyAppSignature);     // HMAC-SHA256 Kriptografik imzo nazorati

// --- ROUTES DEFINITION ---

/**
 * @route   POST /api/v1/bridge/event-logs
 * @desc    Tashqi ilova ichidagi foydalanuvchi harakatlari va telemetriya ma'lumotlarini qabul qilish
 * @access  Private (External Apps with valid cryptographic signature)
 */
router.post(
  '/',
  validateEventPayload(eventLogPayloadSchema), // Ma'lumotlar xavfsizligi va hajmiy cheklov nazorati
  eventLogsController.logEvent
);

module.exports = router;