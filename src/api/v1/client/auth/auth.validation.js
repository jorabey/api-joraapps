const Joi = require('joi');
const { ValidationError } = require('../../../../utils/appErrors');

// Parol xavfsizligi uchun kuchli korrelyatsiya (Regex)
// Kamida 8 ta belgi, 1 ta katta harf, 1 ta kichik harf, 1 ta raqam va 1 ta maxsus belgi
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

/**
 * ⚡ ULTRA-FAST VALIDATION RUNNER
 * `abortEarly: true` rejimi orqali birinchi xatodanoq so'rovni to'xtatamiz.
 * Bu milliardlab so'rovlarda CPU sikllarini maksimal darajada tejaydi.
 */
const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: true, // Birinchi xatoda to'xtash (Tezlik kaliti!)
      allowUnknown: false, // Massiv va obyektlarga ortiqcha (shubhali) maydonlar qo'shishni taqiqlash
      stripUnknown: true   // Schema-da yo'q maydonlarni avtomatik tozalash (Security)
    });

    if (error) {
      const cleanMessage = error.details[0].message.replace(/['"]/g, '');
      return next(new ValidationError(cleanMessage));
    }

    // Tozalangan va formatlangan ma'lumotni qayta yuklash
    req[property] = value;
    next();
  };
};

// --- SCHEMAS DEFINITION ---

const sendOtpSchema = Joi.object({
  email: Joi.string().email().required().lowercase().trim()
});

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required().trim(),
  email: Joi.string().email().required().lowercase().trim(),
  password: Joi.string().pattern(passwordRegex).required().messages({
    'string.pattern.base': 'Parol kamida 8 ta belgi, bittadan katta harf, raqam va maxsus belgi saqlashi shart.'
  }),
  firstName: Joi.string().min(2).max(50).required().trim(),
  lastName: Joi.string().min(2).max(50).required().trim(),
  otpCode: Joi.string().length(6).required().trim() // 6 xonali OTP
});

const loginSchema = Joi.object({
  identifier: Joi.string().required().trim(), // email yoki username
  password: Joi.string().required()
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required().lowercase().trim(),
  otpCode: Joi.string().length(6).required().trim(),
  newPassword: Joi.string().pattern(passwordRegex).required().messages({
    'string.pattern.base': 'Parol talablarga javob bermaydi.'
  })
});

// --- MIDDLEWARES EXPORT ---

module.exports = {
  validateSendOtp: validateRequest(sendOtpSchema),
  validateRegister: validateRequest(registerSchema),
  validateLogin: validateRequest(loginSchema),
  validateResetPassword: validateRequest(resetPasswordSchema)
};