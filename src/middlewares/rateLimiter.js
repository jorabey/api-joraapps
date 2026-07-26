const { RateLimiterRedis } = require('rate-limiter-flexible');
const redisClient = require('../config/redis');
const { AppError } = require('../utils/appErrors');

/**
 * 1. Auth uchun qattiq cheklov (Brute-force hujumlarini to'sish)
 * Masalan: 1 daqiqada maksimal 5 ta urinish.
 */
const authLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'limiter_auth',
  points: 5, // 5 ta urinish
  duration: 60, // 60 soniya ichida
  blockDuration: 60 * 15, // Agar limitdan oshsa, 15 daqiqa bloklash
});

/**
 * 2. Umumiy API uchun moslashuvchan cheklov
 * Masalan: 1 daqiqada 100 ta so'rov.
 */
const apiLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'limiter_api',
  points: 100,
  duration: 60,
});

// Middleware factory: Qaysi limiterni ishlatishni tanlash
const rateLimiter = (limiter) => async (req, res, next) => {
  try {
    // IP address orqali cheklash (Agar foydalanuvchi loginda bo'lsa, userId orqali ham qilsa bo'ladi)
    const key = req.ip; 
    
    await limiter.consume(key);
    next();
  } catch (rejRes) {
    const retryAfter = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(retryAfter));
    next(new AppError(`Juda ko'p so'rov yuborildi. Iltimos, ${retryAfter} soniyadan keyin qayta urinib ko'ring.`, 429));
  }
};

module.exports = {
  authLimiterMiddleware: rateLimiter(authLimiter),
  apiLimiterMiddleware: rateLimiter(apiLimiter)
};