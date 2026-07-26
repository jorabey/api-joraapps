const Joi = require('joi');
const { ValidationError } = require('../../../../utils/appErrors');

// MongoDB ObjectId formatini qat'iy tekshirish uchun xavfsiz regex
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
// Ilova username'i (slug) uchun xavfsiz regex: faqat kichik harflar, raqamlar, chiziqcha va pastki chiziqcha
const appUsernameRegex = /^[a-z0-9-_]+$/;

/**
 * ⚡ MULTI-PURPOSE ULTRA-FAST VALIDATOR RUNNER
 * Dinamik ravishda req.body, req.query yoki req.params ni tekshirishga moslashgan.
 * `abortEarly: true` orqali CPU sikllarini maksimal tejaydi.
 */
const validate = (schema, property) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: true,    // Birinchi xatodanoq to'xtash (Tezlik siri!)
      allowUnknown: false, // Begona maydonlarni mutloq taqiqlash
      stripUnknown: true   // Ortiqcha elementlarni avtomatik qirqib tashlash
    });

    if (error) {
      const cleanMessage = error.details[0].message.replace(/['"]/g, '');
      return next(new ValidationError(cleanMessage));
    }

    req[property] = value; // Tozalangan va sanitizatsiya qilingan ma'lumotni qayta yuklash
    next();
  };
};

// --- SCHEMAS DEFINITION ---

// 1. Ilova yaratish schemasi
const createAppSchema = Joi.object({
  name: Joi.string().min(2).max(50).required().trim(),
  username: Joi.string().pattern(appUsernameRegex).min(3).max(30).required().trim().messages({
    'string.pattern.base': 'Ilova username\'i faqat kichik lotin harflari, raqamlar va chiziqchalardan iborat bo\'lishi shart.'
  }),
  description: Joi.string().max(500).allow('').optional().trim(),
  appUrl: Joi.string().uri().max(255).required().trim(),
  iconUrl: Joi.string().uri().max(255).required().trim()
});

// 2. Ilova yangilash schemasi (Hamma maydon qisman yoki ixtiyoriy kelishi mumkin)
const updateAppSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional().trim(),
  description: Joi.string().max(500).allow('').optional().trim(),
  appUrl: Joi.string().uri().max(255).required().trim(),
  iconUrl: Joi.string().uri().max(255).optional().trim()
});

// 3. Ilovalar ro'yxatini olish (Query) schemasi
const getMyAppsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20)
});

// 4. URL tarkibidagi :id (Param) schemasi
const idParamSchema = Joi.object({
  id: Joi.string().pattern(objectIdRegex).required().messages({
    'string.pattern.base': 'Noto\'g\'ri ob\'ekt identifikatori (Invalid App ID format).'
  })
});

// --- COMBINED MIDDLEWARES EXPORT ---

module.exports = {
  validateCreateApp: validate(createAppSchema, 'body'),
  validateGetMyApps: validate(getMyAppsQuerySchema, 'query'),
  validateAppId: validate(idParamSchema, 'params'),
  
  /**
   * PATCH so'rovlari uchun bir vaqtning o'zida ham ID'ni, 
   * ham yangilanayotgan Payload'ni tekshiruvchi maxsus zanjir (Compound Middleware)
   */
  validateAppIdAndPayload: [
    validate(idParamSchema, 'params'),
    validate(updateAppSchema, 'body')
  ]
};