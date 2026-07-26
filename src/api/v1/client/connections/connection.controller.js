const UserAppConnection = require('../../../../models/UserAppConnection');
const App = require('../../../../models/App');
const AppReport = require('../../../../models/AppReport');
const redis = require('../../../../config/redis');
const { paginate } = require('../../../../utils/pagination');
const { ValidationError, AppError } = require('../../../../utils/appErrors');
const mongoose = require('mongoose');

/**
 * 🔒 REDIS WILDCARD CACHE CLEANER
 */
const clearUserConnectionCache = async (userId) => {
  try {
    const keys = await redis.keys(`user:connected:apps:${userId}:*`);
    if (keys && keys.length > 0) {
      await redis.del(keys);
    }
  } catch (err) {
    console.error('Redis keshini tozalashda xatolik:', err);
  }
};


const SCOPE_KEYS = ['profile', 'email', 'phone', 'gender', 'dob', 'notifications'];
const scopesToPermissions = (scopes) => {
  const permissions = { profile: true }; // profil har doim minimal — UI ham shunday taqdim etadi
  if (Array.isArray(scopes)) {
    scopes.forEach((s) => {
      if (SCOPE_KEYS.includes(s)) permissions[s] = true;
    });
  }
  return permissions;
};

/**
 * 1. ILOVAGA RUXSAT BERISH / O'RNATISH (Connect App)
 */
const connectApp = async (req, res, next) => {
  try {
    const { appId, scopes } = req.body;
    const userId = req.user._id || req.user.id; 

    if (!appId) throw new ValidationError('Ilova identifikatori (appId) majburiy.');

    const app = await App.findOne({ _id: appId, status: 'live' }).lean();
    if (!app) throw new AppError('Ulanmoqchi bo\'lgan ilova topilmadi yoki faol emas.', 404);

    // 🚀 TUZATILDI: foydalanuvchi ConnectModal'da tanlagan scope'lar endi
    // haqiqatda saqlanadi (avval bu yerda har doim faqat {profile:true}
    // yozilar edi — email/phone/gender/dob tanlovlari yo'qolib ketardi).
    const permissions = scopesToPermissions(scopes);

    // 🚀 TUZATILDI: Model enumiga mos ravishda status 'connected' qilib yoziladi
    const connection = await UserAppConnection.findOneAndUpdate(
      { 
        userId: new mongoose.Types.ObjectId(userId), 
        appId: new mongoose.Types.ObjectId(appId) 
      },
      { 
        $set: { status: 'connected', permissions },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    await App.findByIdAndUpdate(appId, { $inc: { 'stats.totalConnections': 1 } });

    await redis.del(`auth:permissions:${userId}:${appId}`);
    await clearUserConnectionCache(userId);

    res.status(200).json({
      status: 'success',
      message: 'Ilova muvaffaqiyatli ulandi.',
      data: { connection }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. ILOVANI O'CHIRISH / RUXSATLARNI BEKOR QILISH (Disconnect App)
 */
const disconnectApp = async (req, res, next) => {
  try {
    const { appId } = req.body;
    const userId = req.user._id || req.user.id; 

    if (!appId) throw new ValidationError('Ilova identifikatori shart.');

    // 🚀 TUZATILDI: status: 'connected' bo'lganini qidirib, uni 'disconnected' holatiga o'tkazamiz
    const connection = await UserAppConnection.findOneAndUpdate(
      { 
        userId: new mongoose.Types.ObjectId(userId), 
        appId: new mongoose.Types.ObjectId(appId), 
        status: 'connected' 
      },
      { $set: { status: 'disconnected' } },
      { new: true }
    ).lean();

    if (!connection) {
      throw new AppError('Ushbu ilova bilan faol aloqa topilmadi.', 404);
    }

    await App.findByIdAndUpdate(appId, { $inc: { 'stats.totalConnections': -1 } });

    await redis.del(`auth:permissions:${userId}:${appId}`);
    await clearUserConnectionCache(userId);

    res.status(200).json({
      status: 'success',
      message: 'Ilova muvaffaqiyatli o\'chirildi.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. FOYDALANUVCHINING ULANGAN ILOVALARI RO'YXATI (Get My Connected Apps)
 */
const getMyConnectedApps = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id; 
    const { page = 1, limit = 20 } = req.query;

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const skip = (parsedPage - 1) * parsedLimit;

    // 1. Keshni tekshirish
    const cacheKey = `user:connected:apps:${userId}:page:${parsedPage}:limit:${parsedLimit}`;
    const cachedApps = await redis.get(cacheKey);

    if (cachedApps) {
      return res.status(200).json({
        status: 'success',
        source: 'cache',
        ...JSON.parse(cachedApps)
      });
    }

    // 2. Qidiruv filtri
    const query = { 
      userId: new mongoose.Types.ObjectId(userId)
    };

    // 3. Jami ulanishlar sonini hisoblash
    const totalDocs = await UserAppConnection.countDocuments(query);

    // 4. Ma'lumotlarni 'App' modelidagi ma'lumotlar bilan birga yuklash (POPULATE)
    const connections = await UserAppConnection.find(query)
      .select('appId permissions updatedAt status userId')
      .populate({
        path: 'appId',
        select: 'name username description iconUrl rating isVerified status', // Siz so'ragan nomi, rasmi (iconUrl) va boshqalar
      })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parsedLimit);

    // 5. Ma'lumotlarni chiroyli formatga keltirish (Natijani toza ko'rinishda chiqarish)
    const docs = connections.map(conn => {
      const appInfo = conn.appId || {}; // Agar ilova o'chib ketgan bo'lsa xato bermasligi uchun
      return {
        connectionId: conn._id,
        permissions: conn.permissions,
        updatedAt: conn.updatedAt,
        status:conn.status,
        user:{
          id:conn.userId
        },
        // Ilovaning hamma ma'lumotlari shu yerga joylashadi
        app: {
          id: appInfo._id || null,
          name: appInfo.name || 'Noma\'lum Ilova',
          username: appInfo.username || '',
          description: appInfo.description || '',
          iconUrl: appInfo.iconUrl || null, // Rasm linki
          rating: appInfo.rating || 0,
          isVerified: appInfo.isVerified || false,
          status:appInfo.status
        }
      };
    });

    // 6. Pagination natijasi
    const totalPages = Math.ceil(totalDocs / parsedLimit);
    const result = {
      docs,
      totalDocs,
      limit: parsedLimit,
      page: parsedPage,
      totalPages,
      hasNextPage: parsedPage < totalPages,
      hasPrevPage: parsedPage > 1
    };

    // 7. Keshga yozish (5 daqiqaga)
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 300);

    res.status(200).json({
      status: 'success',
      source: 'database',
      ...result
    });
  } catch (err) {
    next(err);
  }
};
/**
 * 4. MILLISEKUNDLIK RUXSATNOMALAR TEKSHIRUVI (Check Connection)
 */
const checkConnection = async (req, res, next) => {
  try {
    const { userId, appId } = req.query;
    if (!userId || !appId) throw new ValidationError('userId va appId parametrlari majburiy.');

    const cacheKey = `auth:permissions:${userId}:${appId}`;
    
    const cachedPermissions = await redis.get(cacheKey);
    if (cachedPermissions) {
      return res.status(200).json({
        status: 'success',
        source: 'cache',
        ...JSON.parse(cachedPermissions)
      });
    }

    // 🚀 TUZATILDI: status: 'connected' tekshiruvi qo'shildi
    const connection = await UserAppConnection.findOne({ 
      userId: new mongoose.Types.ObjectId(userId), 
      appId: new mongoose.Types.ObjectId(appId), 
      status: 'connected' 
    })
      .select('permissions')
      .lean();

    const responseData = {
      isConnected: !!connection,
      scopes: connection ? Object.keys(connection.permissions).filter(k => connection.permissions[k]) : []
    };

    await redis.set(cacheKey, JSON.stringify(responseData), 'EX', 3600);

    res.status(200).json({
      status: 'success',
      source: 'database',
      ...responseData
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 5. ILOVANI BLOKLASH (Block App)
 * Foydalanuvchi shaxsiy ravishda ilovani "bloklaydi" — bu disconnect'dan farqli,
 * chunki bloklangan ilova frontendda alohida ko'rsatiladi va faqat
 * "blokdan chiqarish" amali bilan qayta tiklanadi (ConnectionMenu shu holatga mos UI beradi).
 */
const blockApp = async (req, res, next) => {
  try {
    const { appId } = req.body;
    const userId = req.user._id || req.user.id;

    if (!appId) throw new ValidationError('Ilova identifikatori shart.');

    const app = await App.findById(appId).select('_id').lean();
    if (!app) throw new AppError('Ilova topilmadi.', 404);

    const connection = await UserAppConnection.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(userId),
        appId: new mongoose.Types.ObjectId(appId)
      },
      { $set: { status: 'blocked' } },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    await redis.del(`auth:permissions:${userId}:${appId}`);
    await clearUserConnectionCache(userId);

    res.status(200).json({
      status: 'success',
      message: 'Ilova bloklandi.',
      data: { connection }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 6. ILOVANI BLOKDAN CHIQARISH (Unblock App)
 */
const unblockApp = async (req, res, next) => {
  try {
    const { appId } = req.body;
    const userId = req.user._id || req.user.id;

    if (!appId) throw new ValidationError('Ilova identifikatori shart.');

    const connection = await UserAppConnection.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(userId),
        appId: new mongoose.Types.ObjectId(appId),
        status: 'blocked'
      },
      { $set: { status: 'disconnected' } },
      { new: true }
    ).lean();

    if (!connection) {
      throw new AppError('Ushbu ilova bloklangan holatda topilmadi.', 404);
    }

    await redis.del(`auth:permissions:${userId}:${appId}`);
    await clearUserConnectionCache(userId);

    res.status(200).json({
      status: 'success',
      message: 'Ilova blokdan chiqarildi.',
      data: { connection }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 7. ILOVA USTIDAN SHIKOYAT QILISH (Report App)
 * AppReport hujjatini yaratadi — admin panelida moderatorlar tomonidan ko'rib chiqiladi.
 */
const reportApp = async (req, res, next) => {
  try {
    const { appId, reason, description } = req.body;
    const userId = req.user._id || req.user.id;

    const app = await App.findById(appId).select('_id').lean();
    if (!app) throw new AppError('Ilova topilmadi.', 404);

    const report = await AppReport.create({
      reporterId: userId,
      appId,
      reason,
      description: description.trim()
    });

    res.status(201).json({
      status: 'success',
      message: 'Shikoyatingiz qabul qilindi. Moderatorlar tez orada ko\'rib chiqadi.',
      data: { report }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  connectApp,
  disconnectApp,
  getMyConnectedApps,
  checkConnection,
  blockApp,
  unblockApp,
  reportApp
};