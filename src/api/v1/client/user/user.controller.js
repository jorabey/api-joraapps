const User = require('../../../../models/User');
const Session = require('../../../../models/Session');
const { ValidationError, AuthError } = require('../../../../utils/appErrors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


/**
 * 1. PROFIL MA'LUMOTLARINI OLISH (Get Profile)
 * @access Private
 */
const getMe = async (req, res, next) => {
  try {
    // requireAuth middleware'i allaqachon req.user ichiga leandagi foydalanuvchini yuklagan.
    // Hech qanday qo'shimcha DB so'rovisiz darhol javob qaytaramiz (Tezlik: 0ms!)
    res.status(200).json({
      status: 'success',
      data: { user: req.user }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. PROFILNI TAHRIRLASH (Update Profile)
 * @access Private
 */
const updateMe = async (req, res, next) => {
  try {
    const { firstName, lastName } = req.body;

    // XAVFSIZLIK (White-listing): Faqat ruxsat berilgan maydonlarni ajratib olamiz.
    // Xakerlar boshqa muhim maydonlarni (role, isBlocked, email) o'zgartira olmaydi.
    const updateData = {};
    if (firstName) updateData.firstName = firstName.trim();
    if (lastName) updateData.lastName = lastName.trim();

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('Yangilash uchun hech qanday ma\'lumot yuborilmadi.');
    }

    // TEZLIK: findByIdAndUpdate + lean() orqali bitta operatsiyada DB ga yozib qayta o'qiymiz
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -tokenVersion').lean();

    res.status(200).json({
      status: 'success',
      message: 'Profil ma\'lumotlari muvaffaqiyatli yangilandi.',
      data: { user: updatedUser }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. PAROLNI YANGILASH VA TOKENDARNI INVALIDATSIYA QILISH (Change Password)
 * @access Private
 */
const updatePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) throw new ValidationError('Eski va yangi parollar majburiy.');

    // Xavfsizlik: Parolni tekshirish uchun ochiq parolni chaqirib olamiz
    const user = await User.findById(req.user._id).select('+password');
    if (!user) throw new AuthError('Foydalanuvchi topilmadi.');

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) throw new AuthError('Eski parol noto\'g\'ri.');

    // Yangi parolni hashlab yozish (Model pre('save') mantiqini ishlatish uchun doc formatda saqlaymiz)
    user.password = newPassword;

    // 🚀 INVALIDATION: Token versiyasini oshiramiz. 
    // Bu boshqa barcha qurilmalardagi Refresh tokenlarni bir soniyada yaroqsizga aylantiradi.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // Faol turgan joriy cookie tokenidan tashqari barcha sessiyalarni o'chirish (DB tozalash)
    const currentRefreshToken = req.cookies.refreshToken;
    await Session.deleteMany({ 
      userId: user._id, 
      tokenHash: { $ne: currentRefreshToken } 
    });

    res.status(200).json({
      status: 'success',
      message: 'Parol muvaffaqiyatli o\'zgartirildi. Boshqa barcha qurilmalardan tizmda chiqildi.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. FAOLLIK SESSIDALARINI KO'RISH (Device Session List)
 * @access Private
 */
const getMySessions = async (req, res, next) => {
  try {
    // TEZLIK: .lean() orqali Mongoose og'ir funksiyalarisiz sof massiv yuklaymiz.
    // Milliardlab sessiyalar ichidan index yordamida faqat ushbu userga tegishli faol qurilmalarni olamiz.
    const sessions = await Session.find({ userId: req.user._id, isRevoked: false })
      .select('deviceInfo lastActive createdAt tokenHash')
      .sort({ lastActive: -1 })
      .lean();

    // Xavfsizlik: TokenHash ni frontendga ochiq bermaslik uchun uni flag ko'rinishiga keltiramiz
    const currentRefreshToken = req.cookies.refreshToken;
    const decoded = jwt.decode(currentRefreshToken);
    if (!decoded || !decoded.jti) {
        throw new AuthError('Token ichida JTI topilmadi.');
    }
    const formattedSessions = sessions.map(session => ({
      id: session._id,
      deviceInfo: session.deviceInfo,
      lastActive: session.lastActive,
      createdAt: session.createdAt,
      isCurrentDevice: session.tokenHash === decoded.jti
    }));

    res.status(200).json({
      status: 'success',
      data: { sessions: formattedSessions }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 5. BOSHQA QURILMALARDAN CHIQISH (Terminate Other Sessions)
 * @access Private
 */
const terminateOtherSessions = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) throw new AuthError('Sessiya topilmadi.');

    const decoded = jwt.decode(refreshToken);
    if (!decoded || !decoded.jti) {
        throw new AuthError('Token ichida JTI topilmadi.');
    }

    // TUZATILDI: tokenJti o'rniga tokenHash deb yoziladi
    const result = await Session.deleteMany({
      userId: req.user._id,
      tokenHash: { $ne: decoded.jti } 
    });

    res.status(200).json({ status: 'success', deleted: result.deletedCount });
  } catch (err) {
    next(err);
  }
};
module.exports = {
  getMe,
  updateMe,
  updatePassword,
  getMySessions,
  terminateOtherSessions
};