const User = require('../models/User');
const Session = require('../models/Session');
const { generateAccessToken, generateRefreshToken } = require('../utils/generateTokens');
const { AuthError } = require('../utils/appErrors');
const otpService = require('./otp.service');
const jwt = require('jsonwebtoken');

/**
 * LOGIN: Xavfsiz va tezkor kirish
 */
const login = async (identifier, password, deviceInfo) => {
  // 1. Userni qidirish (Password ni select qilamiz, chunki modelda false qilingan)
  const user = await User.findOne({ 
    $or: [{ email: identifier }, { username: identifier }] 
  }).select('+password');

  if (!user || !(await user.matchPassword(password))) {
    throw new AuthError('Email yoki parol noto\'g\'ri.');
  }

  // 2. Bloklanganligini tekshirish
  if (user.isBlocked || user.accountStatus === 'suspended') {
    throw new AuthError('Akkaunt bloklangan.');
  }
  const refreshToken = generateRefreshToken(user);

   const decoded = jwt.decode(refreshToken);

  // 3. Tokenlarni generatsiya qilish
 const accessToken = generateAccessToken(user, decoded.jti);




  // 4. Sessiyani bazaga yozish (Logout qilish imkonini berish uchun)
  await Session.create({
    userId: user._id,
    tokenHash: decoded.jti, // Tokenni ham hashlab saqlash xavfsizroq
    deviceInfo,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 kun
  });

  return { user, accessToken, refreshToken };
};

/**
 * REGISTER: OTP tasdig'i bilan ro'yxatdan o'tish
 */
const register = async (userData, otpCode, deviceInfo) => {
  // 1. OTP ni tekshirish (OtpService orqali)
  await otpService.verifyOTP(userData.email, otpCode);

  // 2. User yaratish
  const user = await User.create(userData);

  // 3. Avtomatik sessiya ochish
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await Session.create({
    userId: user._id,
    tokenHash: refreshToken,
    deviceInfo,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  return { user, accessToken, refreshToken };
};

/**
 * LOGOUT: Sessiyani o'chirish
 */
const logout = async (tokenHash) => {
  return await Session.findOneAndDelete({ tokenHash });
};

/**
 * 🔒 PAROLNI UNUTGANDA QAYTA TIKLASH (Reset Password Service)
 * @param {string} email - Foydalanuvchi emaili
 * @param {string} newPassword - Yangi tanlangan parol
 */
const resetPassword = async (email, newPassword) => {
  // 1. Foydalanuvchini bazadan qidiramiz
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    throw new AuthError('Ushbu email manzili bilan ro‘yxatdan o‘tgan foydalanuvchi topilmadi.');
  }

  // 2. Yangi parolni o'rnatamiz 
  // (Agar modelingizda pre('save') parolni hashlovchi hook bo'lsa, shunchaki tenglashtirish yetarli)
  user.password = newPassword;

  // 3. KIBERXAVFSIZLIK REJIM: Token versiyasini bittaga oshiramiz.
  // Bu barcha eski issued (berilgan) JWT tokenlarni bir soniyada yaroqsiz qiladi.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  // 4. Ushbu foydalanuvchining barcha ochiq sessiyalarini DB'dan tozalab tashlaymiz
  // Foydalanuvchi yangi parol bilan barcha qurilmalardan avtomat chiqib ketadi
  await Session.deleteMany({ userId: user._id });

  return true;
};

module.exports = {
  login,
  register,
  logout,
  resetPassword
};