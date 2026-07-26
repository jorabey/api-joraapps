const crypto = require('crypto');
const redis = require('../config/redis');
const OtpBlock = require('../models/OtpBlock');
const { OtpBlockedError, AuthError } = require('../utils/appErrors');

/**
 * 1. XAVFSIZ: Kriptografik jihatdan kuchli OTP generatsiya qilish
 */
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * 2. OTP ni saqlash (Redis + TTL)
 */
const storeOTP = async (key, otp) => {
  // 120 soniya = 2 daqiqa
  await redis.set(`otp:${key}`, otp, 'EX', 120);
};

/**
 * 3. OTP ni tekshirish va Bloklash mantig'i
 */
const verifyOTP = async (key, enteredOtp) => {
  // Bosqich A: Avval bloklanganmi yo'qligini tekshirish (MongoDB)
  const isBlocked = await OtpBlock.findOne({ key, type: 'auth' });
  if (isBlocked) {
    throw new OtpBlockedError('Siz vaqtincha bloklangansiz. 24 soat kuting.');
  }

  // Bosqich B: OTP ni tekshirish (Redis)
  const storedOtp = await redis.get(`otp:${key}`);
  
  if (!storedOtp) {
    throw new AuthError('OTP muddati o\'tgan yoki noto\'g\'ri.');
  }

  if (storedOtp !== enteredOtp) {
    // Urinishlarni sanash (Redis)
    const attemptsKey = `otp_attempts:${key}`;
    const attempts = await redis.incr(attemptsKey);
    
    if (attempts === 1) await redis.expire(attemptsKey, 120); // 2 daqiqa ichida 3 marta

    if (attempts >= 3) {
      // Bosqich C: 24 soatlik blokirovka (MongoDB)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      await OtpBlock.create({ key, type: 'auth', expiresAt });
      await redis.del(`otp:${key}`); // Eski kodni o'chirish
      throw new OtpBlockedError('Noto\'g\'ri urinishlar ko\'p. 24 soatga bloklandingiz.');
    }

    throw new AuthError(`Noto'g'ri kod. ${3 - attempts} ta urinish qoldi.`);
  }

  // Muvaffaqiyatli: Redisdan tozalash
  await redis.del(`otp:${key}`);
  await redis.del(`otp_attempts:${key}`);
  return true;
};

module.exports = {
  generateOTP,
  storeOTP,
  verifyOTP
};