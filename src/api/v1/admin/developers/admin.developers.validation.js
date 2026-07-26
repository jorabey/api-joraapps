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

const idParamSchema = Joi.object({ id: Joi.string().pattern(objectIdRegex).required() });

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('pending_review', 'active', 'suspended', 'all').optional(),
  q: Joi.string().max(100).allow('').optional()
});

const suspendSchema = Joi.object({
  reason: Joi.string().min(3).max(500).required()
});

module.exports = {
  validateIdParam: validateRequest(idParamSchema, 'params'),
  validateListQuery: validateRequest(listQuerySchema, 'query'),
  validateSuspend: validateRequest(suspendSchema)
};
