const Admin = require('../../../../models/Admin');
const { generateAdminAccessToken, generateAdminRefreshToken } = require('../../../../utils/generateTokens');
const { ValidationError, AuthError, AppError } = require('../../../../utils/appErrors');
const { logAdminAction } = require('../../../../utils/auditLog');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../../../config/env');

const setAdminCookie = (res, token) => {
  res.cookie('adminRefreshToken', token, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'strict',
    path: '/api/v1/admin', // Faqat admin API o'qiy oladi (izolyatsiya)
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
};

/**
 * 1. ADMIN LOGIN
 * @access Public (lekin Admin hujjati oldindan bazada bo'lishi shart — public
 *         ro'yxatdan o'tish yo'q, adminlarni faqat super_admin yaratadi)
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email }).select('+password').lean();

    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      throw new AuthError('Email yoki parol noto\'g\'ri.');
    }

    if (admin.status !== 'active') {
      throw new AuthError('Sizning admin akkauntingiz faol emas.');
    }

    const accessToken = generateAdminAccessToken(admin);
    const refreshToken = generateAdminRefreshToken(admin);

    setAdminCookie(res, refreshToken);

    await Admin.findByIdAndUpdate(admin._id, {
      lastLoginAt: new Date(),
      lastLoginIp: req.ip
    });

    admin.password = undefined;

    logAdminAction({
      admin,
      action: 'admin.login',
      targetType: 'Admin',
      targetId: admin._id,
      description: `${admin.email} tizimga kirdi.`,
      ipAddress: req.ip
    });

    res.status(200).json({
      status: 'success',
      message: 'Admin panelga muvaffaqiyatli kirdingiz.',
      accessToken,
      admin
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. TOKEN ROTATION
 */
const refreshTokens = async (req, res, next) => {
  try {
    const { adminRefreshToken } = req.cookies;
    if (!adminRefreshToken) throw new AuthError('Sessiya topilmadi.');

    const decoded = jwt.verify(adminRefreshToken, config.jwt.refreshSecret);

    const admin = await Admin.findById(decoded.id).select('status tokenVersion role email').lean();
    if (!admin || admin.status !== 'active' || admin.tokenVersion !== decoded.tv) {
      throw new AuthError('Sessiya yaroqsiz. Qayta login qiling.');
    }

    const newAccessToken = generateAdminAccessToken(admin);
    const newRefreshToken = generateAdminRefreshToken(admin);

    setAdminCookie(res, newRefreshToken);

    res.status(200).json({ status: 'success', accessToken: newAccessToken });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AuthError('Admin seansi muddati tugadi.'));
    }
    next(err);
  }
};

/**
 * 3. LOGOUT
 */
const logout = async (req, res, next) => {
  try {
    res.clearCookie('adminRefreshToken', {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'strict',
      path: '/api/v1/admin'
    });
    res.status(200).json({ status: 'success', message: 'Admin seansi yakunlandi.' });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. JORIY ADMIN PROFILI
 */
const getMe = async (req, res, next) => {
  try {
    res.status(200).json({ status: 'success', data: { admin: req.admin } });
  } catch (err) {
    next(err);
  }
};

/**
 * 5. PAROLNI ALMASHTIRISH (o'zini)
 */
const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const admin = await Admin.findById(req.admin._id).select('+password');
    if (!(await bcrypt.compare(oldPassword, admin.password))) {
      throw new ValidationError('Joriy parol noto\'g\'ri.');
    }

    admin.password = newPassword;
    admin.tokenVersion = (admin.tokenVersion || 0) + 1; // barcha eski sessiyalarni bekor qiladi
    await admin.save();

    logAdminAction({
      admin: req.admin,
      action: 'admin.change_password',
      targetType: 'Admin',
      targetId: admin._id,
      description: 'Admin o\'z parolini almashtirdi.',
      ipAddress: req.ip
    });

    res.status(200).json({
      status: 'success',
      message: 'Parol almashtirildi. Barcha boshqa qurilmalardan chiqarildingiz.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 6. YANGI ADMIN YARATISH (faqat super_admin)
 */
const createAdmin = async (req, res, next) => {
  try {
    const { fullName, email, password, role } = req.body;

    const exists = await Admin.findOne({ email }).select('_id').lean();
    if (exists) throw new ValidationError('Ushbu email bilan admin allaqachon mavjud.');

    const admin = await Admin.create({
      fullName, email, password, role,
      createdBy: req.admin._id
    });
    admin.password = undefined;

    logAdminAction({
      admin: req.admin,
      action: 'admin.create',
      targetType: 'Admin',
      targetId: admin._id,
      description: `Yangi admin yaratildi: ${email} (${role})`,
      ipAddress: req.ip
    });

    res.status(201).json({ status: 'success', message: 'Yangi admin yaratildi.', data: { admin } });
  } catch (err) {
    next(err);
  }
};

/**
 * 7. BARCHA ADMINLAR RO'YXATI (faqat super_admin)
 */
const listAdmins = async (req, res, next) => {
  try {
    const admins = await Admin.find().sort({ createdAt: -1 }).lean();
    res.status(200).json({ status: 'success', data: { admins } });
  } catch (err) {
    next(err);
  }
};

/**
 * 8. ADMIN HOLATINI O'ZGARTIRISH — suspend/reactivate (faqat super_admin)
 */
const setAdminStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'active' | 'suspended'

    if (!['active', 'suspended'].includes(status)) {
      throw new ValidationError('Status faqat active yoki suspended bo\'lishi mumkin.');
    }
    if (String(id) === String(req.admin._id)) {
      throw new ValidationError('O\'zingizning holatingizni o\'zgartira olmaysiz.');
    }

    const admin = await Admin.findByIdAndUpdate(
      id,
      { status, $inc: { tokenVersion: 1 } }, // suspend bo'lsa, mavjud sessiyalar ham bekor bo'ladi
      { new: true }
    );
    if (!admin) throw new AppError('Admin topilmadi.', 404);

    logAdminAction({
      admin: req.admin,
      action: status === 'suspended' ? 'admin.suspend' : 'admin.reactivate',
      targetType: 'Admin',
      targetId: admin._id,
      description: `${admin.email} holati: ${status}`,
      ipAddress: req.ip
    });

    res.status(200).json({ status: 'success', message: 'Admin holati yangilandi.', data: { admin } });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  refreshTokens,
  logout,
  getMe,
  changePassword,
  createAdmin,
  listAdmins,
  setAdminStatus
};
