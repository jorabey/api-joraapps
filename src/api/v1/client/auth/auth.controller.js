const authService = require('../../../../services/auth.service');
const otpService = require('../../../../services/otp.service');
const { sendEmail } = require('../../../../services/email.service');
const { ValidationError, AuthError } = require('../../../../utils/appErrors');
const jwt = require('jsonwebtoken');
const config = require('../../../../config/env');
const Session = require('../../../../models/Session');
const UAParser = require('ua-parser-js');
// 🚀 TUZATILDI: Token generatsiya qiluvchi funksiyalarni to'g'ridan-to'g'ri utilitdan import qilamiz
const { generateAccessToken, generateRefreshToken } = require('../../../../utils/generateTokens');

// Helper: Qurilma va IP ma'lumotlarini xavfsiz ajratib olish
const extractDeviceInfo = (req) => {
  // 1. User-Agent sarlavhasini olamiz va parserga beramiz
  const uaString = req.headers['user-agent'] || '';
  const parser = new UAParser(uaString);
  const uaResult = parser.getResult();

  // 2. IP manzilini proxy (Nginx, Vercel, Cloudflare) orqasidan ham to'g'ri ajratib olish
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '127.0.0.1';
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim(); // Agar IP'lar ro'yxati kelsa, birinchisi haqiqiy foydalanuvchiniki bo'ladi
  }

  // 3. Joylashuvni aniqlash (Siz Vercel ishlatayotganingiz uchun u productionda geo-headerlarni beradi)
  // Lokal muhitda (localhost) bular bo'lmaydi, shuning uchun default 'UZ' va 'Tashkent' qoladi
  const country = req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || 'UZ';
  const city = req.headers['x-vercel-ip-city'] || 'Tashkent';

  // 4. Qurilma turini chiroyli formatlash (Kutubxona desktop qurilmalarni undefined qaytaradi)
  const rawDeviceType = uaResult.device.type || 'desktop';
  const deviceType = rawDeviceType.charAt(0).toUpperCase() + rawDeviceType.slice(1);

  return {
    osName: uaResult.os.name || 'Unknown OS',
    osVersion: uaResult.os.version || 'Unknown Version',
    browser: uaResult.browser.name ? `${uaResult.browser.name} (v${uaResult.browser.version})` : 'Unknown Browser',
    deviceType: deviceType,
    ipAddress: ip,
    location: {
      country: country,
      city: city
    }
  };
};

// Helper: Refresh tokenni xavfsiz Cookie ichiga joylash (XSS va CSRF himoyasi)
const setRefreshTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true, // JavaScript o'qiy olmaydi (XSS himoyasi)
    secure: true, // Faqat HTTPS orqali o'tadi
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 kun yashaydi
  });
};

/**
 * 1. OTP JONATISH (Sign-Up yoki Login uchun)
 */
const sendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new ValidationError('Email manzili kiritilishi shart.');

    const otp = otpService.generateOTP();
    await otpService.storeOTP(email, otp);

    await sendEmail(
      email, 
      'Sizning tasdiqlash kodingiz', 
      `<h1>AppStore xavfsizlik tizimi</h1><p>Sizning tasdiqlash kodingiz: <b>${otp}</b>. Kod muddati 2 daqiqa.</p>`
    );

    res.status(200).json({
      status: 'success',
      message: 'Tasdiqlash kodi emailingizga muvaffaqiyatli yuborildi.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. RO'YXATDAN O'TISH (Sign-Up)
 */
const register = async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName, otpCode, phone } = req.body;
    
    if (!otpCode) throw new ValidationError('OTP tasdiqlash kodi shart.');
    const deviceInfo = extractDeviceInfo(req);

    const { user, accessToken, refreshToken } = await authService.register(
      { username, email, password, firstName, lastName, phone },
      otpCode,
      deviceInfo
    );

    setRefreshTokenCookie(res, refreshToken);

    res.status(201).json({
      status: 'success',
      message: 'Muvaffaqiyatli ro\'yxatdan o\'tdingiz.',
      accessToken,
      user
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. TIZIMGA KIRISH (Sign-In)
 */
const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) throw new ValidationError('Login va parol shart.');

    const deviceInfo = extractDeviceInfo(req);
    const { user, accessToken, refreshToken } = await authService.login(identifier, password, deviceInfo);

    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      status: 'success',
      message: 'Tizimga muvaffaqiyatli kirdingiz.',
      accessToken,
      user
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. TOKEN ROTATION (Sessiyani yangilash)
 */
const rotateTokens = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) throw new AuthError('Sessiya muddati tugagan.');

    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);

    // O'chirish o'rniga, shunchaki sessiyani tekshiramiz
    const activeSession = await Session.findOne({ tokenHash: refreshToken });
    
    // Agar sessiya topilmasa, token eskirgan deb hisoblaymiz
    if (!activeSession) {
      throw new AuthError('Sessiya yaroqsiz.');
    }

    // Eski sessiyani o'chiramiz
    await Session.findByIdAndDelete(activeSession._id);

    // Yangi tokenlar
    const userTokenPayload = { _id: decoded.id };
    const newAccessToken = generateAccessToken(userTokenPayload);
    const newRefreshToken = generateRefreshToken(userTokenPayload);

    // Yangi sessiyani saqlash
    await Session.create({
      userId: decoded.id,
      tokenHash: newRefreshToken,
      deviceInfo: extractDeviceInfo(req),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    setRefreshTokenCookie(res, newRefreshToken);

    res.status(200).json({
      status: 'success',
      accessToken: newAccessToken
    });
  } catch (err) {
    // Agar token expired bo'lsa, uni cookie'dan tozalab tashlaymiz
    res.clearCookie('refreshToken');
    next(err);
  }
};
/**
 * 5. TIZIMDAN CHIQISH (Log-Out)
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    
    if (refreshToken) {
      const decoded = jwt.decode(refreshToken);
       if (!decoded || !decoded.jti) {
        throw new AuthError('Token ichida JTI topilmadi.');
    }

      await authService.logout(decoded.jti);
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'strict'
    });

    res.status(200).json({
      status: 'success',
      message: 'Tizimdan muvaffaqiyatli chiqdingiz.'
    });
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, otpCode, newPassword } = req.body;

    // 1. OTP kodni Redis orqali tekshirish (Agar xato bo'lsa verifyOTP avtomat xato otadi)
    await otpService.verifyOTP(email, otpCode);

    // 2. authService ichida parolni yangilash mantiqini chaqiramiz
    await authService.resetPassword(email, newPassword); 

    res.status(200).json({
      status: 'success',
      message: 'Parolingiz muvaffaqiyatli yangilandi. Yangi parol bilan kirishingiz mumkin.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendOtp,
  register,
  login,
  rotateTokens,
  logout,
  resetPassword
};