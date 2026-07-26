const jwt = require('jsonwebtoken');
const { AuthError } = require('../utils/appErrors');
const User = require('../models/User');
const config = require('../config/env');
const Session = require('../models/Session');

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('Autentifikatsiya uchun token talab qilinadi.');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.accessSecret);

    // 🚀 LAHZADA TEKSHIRISH (Instant Termination)
    // Agar sessiya o'chirilgan bo'lsa, sId bazadan topilmaydi
    const sessionExists = await Session.exists({ userId: decoded.id, tokenHash: decoded.sId });
    if (!sessionExists) {
      throw new AuthError('Sessiyangiz boshqa qurilma tomonidan yakunlangan. Qayta login qiling.');
    }

    const user = await User.findById(decoded.id).select('-password').lean();
    if (!user) throw new AuthError('Foydalanuvchi topilmadi.');
    if (user.isBlocked) throw new AuthError('Ushbu akkaunt vaqtinchalik bloklangan.');

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AuthError('Token muddati o\'tgan. Iltimos, qayta login qiling.'));
    }
    return next(err);
  }
};

module.exports = requireAuth;