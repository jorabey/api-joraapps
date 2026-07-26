const Joi = require('joi');
const { ValidationError } = require('../../../../utils/appErrors');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const validateRequest = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: true,
    allowUnknown: false,
    stripUnknown: true
  });
  if (error) {
    const cleanMessage = error.details[0].message.replace(/['"]/g, '');
    return next(new ValidationError(cleanMessage));
  }
  req[source] = value;
  next();
};

const appIdParamSchema = Joi.object({
  id: Joi.string().pattern(objectIdRegex).required()
});

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('under_review', 'live', 'suspended', 'all').optional(),
  category: Joi.string().valid('games', 'finance', 'social', 'productivity', 'shopping', 'education', 'entertainment', 'utilities', 'other', 'all').optional(),
  q: Joi.string().max(100).allow('').optional(),
  sortBy: Joi.string().valid('newest', 'oldest', 'rating', 'mau', 'name').default('newest')
});

const approveSchema = Joi.object({
  category: Joi.string().valid('games', 'finance', 'social', 'productivity', 'shopping', 'education', 'entertainment', 'utilities', 'other').optional(),
  isVerified: Joi.boolean().optional()
});

const rejectSchema = Joi.object({
  reason: Joi.string().min(3).max(500).required()
});

const suspendSchema = Joi.object({
  reason: Joi.string().min(3).max(500).required()
});

const categorySchema = Joi.object({
  category: Joi.string().valid('games', 'finance', 'social', 'productivity', 'shopping', 'education', 'entertainment', 'utilities', 'other').required()
});

const verifySchema = Joi.object({
  isVerified: Joi.boolean().required()
});

module.exports = {
  validateAppIdParam: validateRequest(appIdParamSchema, 'params'),
  validateListQuery: validateRequest(listQuerySchema, 'query'),
  validateApprove: validateRequest(approveSchema),
  validateReject: validateRequest(rejectSchema),
  validateSuspend: validateRequest(suspendSchema),
  validateCategory: validateRequest(categorySchema),
  validateVerify: validateRequest(verifySchema)
};
