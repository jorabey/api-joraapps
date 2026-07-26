const User = require('../../../../models/User');
const UserAppConnection = require('../../../../models/UserAppConnection');
const redis = require('../../../../config/redis');
const { ValidationError, AuthError, AppError } = require('../../../../utils/appErrors');

/**
 * ⚡ SCOPE-BASED FIELD WHITELIST
 * Qaysi ruxsatnoma (scope) uchun foydalanuvchining qaysi maydonlarini berish mumkinligini belgilaydi.
 * Bu tizimda xakerlar boshqa maxfiy maydonlarni aslo o'g'irlay olmasligini kafolatlaydi.
 */
const SCOPE_FIELDS_MAP = {
  'read_profile': ['username', 'firstName', 'lastName', 'avatarUrl', 'fullName'],
  'read_email': ['email']
};

/**
 * 🚀 GET USER DATA (App to Server via POST)
 * Ilovalar uchun foydalanuvchi ma'lumotlarini qat'iy scope filtri ostida va keshdan o'ta tezkor berish
 */
const getUserData = async (req, res, next) => {
  try {
    // 🔐 KRITIK O'ZGARISH: Ma'lumotlarni req.query dan emas, ruter tozalagan req.body dan olamiz!
    const { userId, bypassCache = false } = req.body;
    
    // req.appInfo 'verifyAppSignature' middleware'i tomonidan yuklangan
    const { _id: appId } = req.appInfo; 

    if (!userId) {
      throw new ValidationError('Foydalanuvchi identifikatori (userId) kiritilishi shart.');
    }

    // 1-BOSQICH (Ruxsatnomani tekshirish): Ilova va User o'rtasidagi aloqa keshini o'qish
    const permissionCacheKey = `auth:permissions:${userId}:${appId}`;
    let permissions = null;

    // Agar keshni aylanib o'tish buyrug'i bo'lmasa, keshdan o'qiymiz
    if (!bypassCache) {
      const cachedPermissions = await redis.get(permissionCacheKey);
      if (cachedPermissions) permissions = JSON.parse(cachedPermissions);
    }

    if (!permissions) {
      // Keshda bo'lmasa, indekslangan unique compound query orqali DB dan tekshiramiz
      const connection = await UserAppConnection.findOne({ userId, appId, status: 'connected' }).lean();
      
      if (!connection) {
        throw new AuthError('Ushbu foydalanuvchi ilovangizga ruxsat bermagan yoki aloqani uzgan.');
      }

      // 🔄 DYNAMIC ADAPTER: Agar bazada scopes massivi bo'lmasa, permissions obyektidan dinamik hosil qilamiz
      let dynamicScopes = connection.scopes || [];
      if (dynamicScopes.length === 0 && connection.permissions) {
        if (connection.permissions.profile || connection.permissions.profile === undefined) dynamicScopes.push('read_profile');
        if (connection.permissions.email) dynamicScopes.push('read_email');
      }

      permissions = { isConnected: true, scopes: dynamicScopes };
      
      // 1 soatga keshga yozish
      await redis.set(permissionCacheKey, JSON.stringify(permissions), 'EX', 3600);
    }

    if (!permissions.scopes || permissions.scopes.length === 0) {
      throw new AuthError('Ilovada foydalanuvchi ma\'lumotlarini o\'qish uchun hech qanday ruxsat (scope) yo\'q.');
    }

    // 2-BOSQICH (Ma'lumotni yuklash): Foydalanuvchi profilini keshdan qidirish
    const userCacheKey = `user:profile:${userId}`;
    let user = null;

    if (!bypassCache) {
      const cachedUser = await redis.get(userCacheKey);
      if (cachedUser) user = JSON.parse(cachedUser);
    }

    if (!user) {
      // Keshda bo'lmasa, bazadan parolsiz va og'irliksiz (.lean()) yuklash
      user = await User.findById(userId).select('-password -tokenVersion').lean();
      if (!user) {
        throw new AppError('Foydalanuvchi topilmadi.', 404, 'USER_NOT_FOUND');
      }
      // Profil o'zgarganda 'user.controller' bu keshni avtomat o'chiradi. Shuning uchun 24 soatga qo'yamiz.
      await redis.set(userCacheKey, JSON.stringify(user), 'EX', 86400);
    }

    // 3-BOSQICH (Dinamik Maskalash / Security Isolation):
    // Ilovaga faqat u so'ragan va user ruxsat bergan maydonlarnigina süzgichdan o'tkazib beramiz
    const allowedFields = new Set();
    permissions.scopes.forEach(scope => {
      if (SCOPE_FIELDS_MAP[scope]) {
        SCOPE_FIELDS_MAP[scope].forEach(field => allowedFields.add(field));
      }
    });

    // Sof, filtrlangan xavfsiz obyekt tuzish
    const maskedUserData = { id: user._id };
    allowedFields.forEach(field => {
      if (user[field] !== undefined) {
        maskedUserData[field] = user[field];
      }
    });

    res.status(200).json({
      status: 'success',
      source: bypassCache ? 'database' : 'cache',
      data: { user: maskedUserData }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUserData
};