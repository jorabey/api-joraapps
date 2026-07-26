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
  status: Joi.string().valid('pending', 'investigating', 'resolved', 'rejected', 'all').optional(),
  reason: Joi.string().valid('spam', 'inappropriate', 'malware', 'copyright', 'fake_app', 'other', 'all').optional(),
  appId: Joi.string().pattern(objectIdRegex).optional()
});

const resolveSchema = Joi.object({
  adminComment: Joi.string().max(1000).allow('').optional()
});

const rejectSchema = Joi.object({
  adminComment: Joi.string().min(3).max(1000).required()
});

const setStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'investigating', 'resolved', 'rejected').required(),
  adminComment: Joi.string().max(1000).allow('').optional()
});

module.exports = {
  validateIdParam: validateRequest(idParamSchema, 'params'),
  validateListQuery: validateRequest(listQuerySchema, 'query'),
  validateResolve: validateRequest(resolveSchema),
  validateReject: validateRequest(rejectSchema),
  validateSetStatus: validateRequest(setStatusSchema)
};
