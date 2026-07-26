const App = require('../models/App');
const redis = require('../config/redis');
const { AuthError } = require('../utils/appErrors');

/**
 * Ilova xavfsizligini tekshirish va ma'lumotlarni keshdan olish.
 * Yuqori yuklamalar (high-scale) uchun optimallashtirilgan.
 */
const getValidatedApp = async (appToken) => {
  const cacheKey = `app:data:${appToken}`;

  // 1. Redis Keshdan qidirish (Tezlik: < 1ms)
  const cachedApp = await redis.get(cacheKey);
  if (cachedApp) return JSON.parse(cachedApp);

  // 2. Bazadan qidirish (Agar keshda bo'lmasa)
  const app = await App.findOne({ appToken })
    .select('+appSecret')
    .lean();

  if (!app) throw new AuthError('Ilova topilmadi.');
  if (app.status !== 'live') throw new AuthError('Ilova faol emas.');

  // 3. Keshga saqlash (1 soatga)
  await redis.set(cacheKey, JSON.stringify(app), 'EX', 3600);
  
  return app;
};

/**
 * Permission Validation: Ilova foydalanuvchi ma'lumotini olishga haqlimi?
 * Bu ruxsatlar (scopes) ni tekshirish uchun.
 */
const hasPermission = (app, permissionField) => {
  // Bu yerda App modeliga bog'liq qo'shimcha logika bo'lishi mumkin
  // Masalan: Ilova "email" ga ruxsat so'rayapti, lekin u "pro-level" ruxsat bo'lishi mumkin
  return true; // Hozircha barchasiga ruxsat, keyinchalik scope qo'shishingiz mumkin
};

/**
 * Xavfsizlik: Cache'ni tozalash (Ilova yangilanganida chaqiriladi)
 */
const invalidateAppCache = async (appToken) => {
  await redis.del(`app:data:${appToken}`);
};

module.exports = {
  getValidatedApp,
  hasPermission,
  invalidateAppCache
};