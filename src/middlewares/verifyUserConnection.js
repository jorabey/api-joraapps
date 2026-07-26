const UserAppConnection = require('../models/UserAppConnection');
const { AuthError } = require('../utils/appErrors');

const verifyUserConnection = async (req, res, next) => {
  try {
    // req.body ichida userId bo'lishi shart (Joi validatsiyadan o'tgan)
    const { userId } = req.body; 
    const appId = req.app._id; // verifyAppSignature middleware'idan keladi

    if (!userId) {
      throw new AuthError('Foydalanuvchi identifikatori (userId) yetishmayapti.');
    }

    // 🚀 PERFORMANCE & ISOLATION: Ulanish holatini tekshiramiz
    const connection = await UserAppConnection.findOne({ userId, appId }).lean();

    if (!connection) {
      throw new AuthError('Foydalanuvchi ushbu ilovadan ro\'yxatdan o\'tmagan.');
    }

    if (connection.status !== 'connected') {
      throw new AuthError(`Ilova bilan aloqa uzilgan yoki bloklangan. Holat: ${connection.status}`);
    }

    // Ruxsatnomalar obyektini keyingi controllerga xavfsiz o'tkazamiz
    req.userPermissions = connection.permissions;
    
    // Statistika uchun oxirgi foydalanish vaqtini yangilab qo'yamiz (Asinxron - so'rovni kutib qolmaydi)
    UserAppConnection.updateOne({ _id: connection._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = verifyUserConnection;