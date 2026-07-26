const Developer = require('../../../../models/Developer');
const { generateAccessToken, generateRefreshToken } = require('../../../../utils/generateTokens');
const { ValidationError, AuthError } = require('../../../../utils/appErrors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../../../config/env');

// Helper: Faqat dasturchilar uchun xavfsiz Cookie sozlamalari
const setDevCookie = (res, token) => {
  res.cookie('devRefreshToken', token, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'strict',
    path: '/api/v1/developer', // Faqat developer API o'qiy oladi (Xavfsizlik izolyatsiyasi)
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 kun
  });
};

/**
 * 1. DASTURCHI RO'YXATDAN O'TISHI (Developer Registration)
 * @access Public
 */
const register = async (req, res, next) => {
  try {
    const { companyName, email, password, website } = req.body;

    // XAVFSIZLIK: Mass-assignment hujumidan himoya (Faqat kerakli maydonlar)
    const devData = {
      companyName: companyName.trim(),
      email: email.toLowerCase().trim(),
      password,
      website: website ? website.trim() : undefined,
      status: 'pending_review' // Yangi dasturchilar avtomatik 'pending' (kutish) holatida bo'ladi
    };

    // Bazada email bandligini tekshirish (Tezlik uchun faqat ID ni o'qiymiz)
    const isEmailExist = await Developer.findOne({ email: devData.email }).select('_id').lean();
    if (isEmailExist) {
      throw new ValidationError('Ushbu email manzili allaqachon ro\'yxatdan o\'tgan.');
    }

    const developer = await Developer.create(devData);
    
    // Parolni javobdan o'chirib tashlaymiz
    developer.password = undefined;

    res.status(201).json({
      status: 'success',
      message: 'Dasturchi akkaunti yaratildi. Tasdiqlash jarayoni boshlandi.',
      data: { developer }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. TIZIMGA KIRISH (Developer Login)
 * @access Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new ValidationError('Email va parol kiritilishi shart.');

    // TEZLIK: .select('+password') orqali parolni olamiz, qolgan hamma narsa sof JSON (.lean())
    const developer = await Developer.findOne({ email: email.toLowerCase().trim() })
      .select('+password')
      .lean();

    // XAVFSIZLIK: User Enumeration hujumiga yo'l qo'ymaslik uchun umumiy xabar
    if (!developer || !(await bcrypt.compare(password, developer.password))) {
      throw new AuthError('Email yoki parol noto\'g\'ri.');
    }

    // 🔐 KRITIK NAZORAT: Faqat 'active' holatdagi dasturchilarga ruxsat berish
    if (developer.status !== 'active') {
      throw new AuthError('Sizning akkauntingiz adminlar tomonidan hali tasdiqlanmagan yoki bloklangan.');
    }

    // Tokenlarni yaratish (Dasturchi uchun maxsus devSecret bilan)
    const accessToken = generateAccessToken({ _id: developer._id, role: 'developer' });
    const refreshToken = generateRefreshToken({ _id: developer._id, version: developer.tokenVersion || 0 });

    setDevCookie(res, refreshToken);

    // Parolni frontendlarga aslo ko'rsatmaymiz
    developer.password = undefined;

    res.status(200).json({
      status: 'success',
      message: 'Dasturchi paneliga muvaffaqiyatli kirdingiz.',
      accessToken,
      developer
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. TOKEN ROTATION (Refresh Developer Tokens)
 * @access Public
 */
const refreshTokens = async (req, res, next) => {
  try {
    const { devRefreshToken } = req.cookies;
    if (!devRefreshToken) throw new AuthError('Sessiya topilmadi (No token).');

    // Tokenni shifrini ochish
    const decoded = jwt.verify(devRefreshToken, config.jwt.refreshSecret);

    // XAVFSIZLIK: Dasturchining joriy holatini va token versiyasini tekshirish
    const developer = await Developer.findById(decoded.id).select('status tokenVersion').lean();
    if (!developer || developer.status !== 'active' || developer.tokenVersion !== decoded.version) {
      throw new AuthError('Sessiya yaroqsiz yoki akkaunt holati o\'zgargan. Qayta login qiling.');
    }

    // Yangi tokenlar zanjirini yaratish
    const newAccessToken = generateAccessToken({ _id: developer._id, role: 'developer' });
    const newRefreshToken = generateRefreshToken({ _id: developer._id, version: developer.tokenVersion });

    setDevCookie(res, newRefreshToken);

    res.status(200).json({
      status: 'success',
      accessToken: newAccessToken
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AuthError('Dasturchi seansi muddati tugadi.'));
    }
    next(err);
  }
};

/**
 * 4. TIZIMDAN CHIQISH (Developer Logout)
 * @access Public
 */
const logout = async (req, res, next) => {
  try {
    res.clearCookie('devRefreshToken', {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'strict',
      path: '/api/v1/developer'
    });

    res.status(200).json({
      status: 'success',
      message: 'Dasturchi seansi muvaffaqiyatli yakunlandi.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  refreshTokens,
  logout
};