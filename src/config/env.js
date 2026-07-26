const Joi = require('joi');
require('dotenv').config();

// 1. Env o'zgaruvchilari uchun sxemani yaratamiz
const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(5000),
  MONGO_URI: Joi.string().required().description('MongoDB ulanish manzili shart!'),
  JWT_SECRET: Joi.string().required().description('JWT maxfiy kaliti shart!'),
  REDIS_URL: Joi.string().optional(),
})
.unknown() // .env ichida boshqa narsalar bo'lsa ham xatolik bermaydi
.required();

// 2. Validatsiya (tekshiruv)
const { error, value: envVars } = envVarsSchema.validate(process.env);

if (error) {
  throw new Error(`Config xatolik: ${error.message}`);
}

// 3. Eksport
module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS || '*'
  },
  db: {
    uri: envVars.MONGO_URI,
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    devSecret: process.env.JWT_DEV_SECRET,
    adminSecret: process.env.JWT_ADMIN_SECRET,
  },
  redis: {
    url: envVars.REDIS_URL,
  }
};