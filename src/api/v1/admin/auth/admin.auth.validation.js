const Joi = require('joi');
const { ValidationError } = require('../../../../utils/appErrors');

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const validateRequest = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: true,
    allowUnknown: false,
    stripUnknown: true
  });
  if (error) {
    const cleanMessage = error.details[0].message.replace(/['"]/g, '');
    return next(new ValidationError(cleanMessage));
  }
  req.body = value;
  next();
};

const loginSchema = Joi.object({
  email: Joi.string().email().required().lowercase().trim(),
  password: Joi.string().required()
});

// Faqat super_admin tomonidan boshqa adminlarni yaratish uchun
const createAdminSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).required().trim(),
  email: Joi.string().email().required().lowercase().trim(),
  password: Joi.string().pattern(passwordRegex).required().messages({
    'string.pattern.base': 'Parol kamida 8 ta belgi, katta-kichik harf, raqam va maxsus belgi (@$!%*?&) saqlashi shart.'
  }),
  role: Joi.string().valid('super_admin', 'moderator', 'support').required()
});

const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().pattern(passwordRegex).required().messages({
    'string.pattern.base': 'Yangi parol kamida 8 ta belgi, katta-kichik harf, raqam va maxsus belgi (@$!%*?&) saqlashi shart.'
  })
});

module.exports = {
  validateLogin: validateRequest(loginSchema),
  validateCreateAdmin: validateRequest(createAdminSchema),
  validateChangePassword: validateRequest(changePasswordSchema)
};
