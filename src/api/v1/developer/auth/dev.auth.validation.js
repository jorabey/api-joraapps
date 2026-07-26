const Joi = require('joi');
const { ValidationError } = require('../../../../utils/appErrors');

// ReDoS (Regular Expression Denial of Service) hujumlaridan himoyalangan xavfsiz parol regexi
// Kamida 8 ta belgi, 1 ta katta harf, 1 ta kichik harf, 1 ta raqam va 1 ta maxsus belgi
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

/**
 * ⚡ ULTRA-FAST VALIDATION RUNNER
 * `abortEarly: true` orqali CPU sikllarini maksimal darajada tejaymiz.
 */
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: true,    // Birinchi xatodanoq tekshirishni to'xtatish (Tezlik kaliti!)
      allowUnknown: false, // Schema ichida e'lon qilinmagan begona maydonlarni qat'iyan taqiqlash
      stripUnknown: true   // Shubhali maydonlarni avtomatik ravishda tozalab tashlash (Security)
    });

    if (error) {
      const cleanMessage = error.details[0].message.replace(/['"]/g, '');
      return next(new ValidationError(cleanMessage));
    }

    // Tozalangan va formatlangan xavfsiz ma'lumotni req.body'ga qayta yuklaymiz
    req.body = value;
    next();
  };
};

// --- SCHEMAS DEFINITION ---

const registerSchema = Joi.object({
  companyName: Joi.string().min(2).max(100).required().trim(),
  email: Joi.string().email().required().lowercase().trim(),
  password: Joi.string().pattern(passwordRegex).required().messages({
    'string.pattern.base': 'Dasturchi paroli kamida 8 ta belgi, bittadan katta harf, raqam va maxsus belgi saqlashi shart.'
  }),
  website: Joi.string().uri().max(200).optional().trim() // Veb-sayt to'g'ri URI formatda bo'lishi shart
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().lowercase().trim(),
  password: Joi.string().required()
});

// --- MIDDLEWARES EXPORT ---

module.exports = {
  validateRegister: validateRequest(registerSchema),
  validateLogin: validateRequest(loginSchema)
};