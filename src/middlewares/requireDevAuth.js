const jwt = require('jsonwebtoken');
const { AuthError } = require('../utils/appErrors');
const Developer = require('../models/Developer');
const config = require('../config/env');

const requireDevAuth = async (req, res, next) => {
  try {
    // 1. Tokenni tekshirish
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('Dasturchi autentifikatsiyasi talab qilinadi.');
    }

    const token = authHeader.split(' ')[1];

    // 2. JWT ni tekshirish (Dasturchilar uchun maxsus secret kalit ishlatish tavsiya etiladi)
    const decoded = jwt.verify(token, config.jwt.devSecret || config.jwt.accessSecret);

    // 3. Bazadan dasturchini qidirish (Performance uchun .lean() va .select())
    const developer = await Developer.findById(decoded.id)
      .select('-password') 
      .lean();

    if (!developer) {
      throw new AuthError('Dasturchi topilmadi.');
    }

    // 4. XAVFSIZLIK: Dasturchi akkaunti tasdiqlanganmi va aktivmi?
    // Bu eng muhim qism: bloklangan dasturchi API ga kirmasligi kerak.
    if (developer.status !== 'active') {
      throw new AuthError('Sizning akkauntingiz hali tasdiqlanmagan yoki faol emas.');
    }

    // 5. Request'ga yuklash
    req.developer = developer;
    next();
    
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return next(new AuthError('Noto\'g\'ri token.'));
    }
    return next(err);
  }
};

module.exports = requireDevAuth;