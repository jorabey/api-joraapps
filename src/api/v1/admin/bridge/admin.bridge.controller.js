const App = require('../../../../models/App');
const redis = require('../../../../config/redis');
const { AppError, ValidationError } = require('../../../../utils/appErrors');
const { logAdminAction } = require('../../../../utils/auditLog');

const clearBridgeCache = async (app) => {
  try {
    await Promise.all([
      redis.del(`app:data:${app.appToken}`),
      redis.del(`app_secret:${app.appToken}`)
    ]);
  } catch (err) {
    console.error('⚠️ Bridge keshini tozalashda xatolik:', err.message);
  }
};

/**
 * 1. BRIDGE FAOLLIGI UMUMIY KO'RINISHI
 * Har bir 'live' ilova uchun bugungi taxminiy faol foydalanuvchilar sonini
 * (Redis HyperLogLog orqali, event-logs ingestion'dan) qaytaradi —
 * bu Bridge API orqali qaysi ilovalar haqiqatda eng faol ishlatilayotganini ko'rsatadi.
 */
const getBridgeOverview = async (req, res, next) => {
  try {
    const liveApps = await App.find({ status: { $in: ['live', 'suspended'] } })
      .select('name username status appToken stats')
      .sort({ 'stats.mau': -1 })
      .limit(100)
      .lean();

    const today = new Date().toISOString().split('T')[0];

    const withDau = await Promise.all(
      liveApps.map(async (app) => {
        let dauToday = 0;
        try {
          dauToday = await redis.pfcount(`analytics:app:${app._id}:dau:${today}`);
        } catch {
          dauToday = 0;
        }
        return {
          _id: app._id,
          name: app.name,
          username: app.username,
          status: app.status,
          mau: app.stats?.mau || 0,
          dauToday,
          bridgeOpen: app.status === 'live'
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: {
        apps: withDau.sort((a, b) => b.dauToday - a.dauToday),
        generatedAt: new Date()
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. BITTA ILOVANING BRIDGE HOLATI
 */
const getAppBridgeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const app = await App.findById(id).select('name username status appToken stats').lean();
    if (!app) throw new AppError('Ilova topilmadi.', 404);

    const today = new Date().toISOString().split('T')[0];
    let dauToday = 0;
    try {
      dauToday = await redis.pfcount(`analytics:app:${app._id}:dau:${today}`);
    } catch {
      dauToday = 0;
    }

    const queueLength = await redis.llen('queue:event-logs').catch(() => null);

    res.status(200).json({
      status: 'success',
      data: {
        app: {
          _id: app._id,
          name: app.name,
          username: app.username,
          status: app.status,
          bridgeOpen: app.status === 'live',
          dauToday,
          mau: app.stats?.mau || 0
        },
        globalEventQueueLength: queueLength
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. BRIDGE API'NI DARHOL YOPISH (ilovani suspend qilmasdan, faqat Bridge'ni yopish)
 * Eslatma: hozirgi `verifyAppSignature` middleware'i faqat `status === 'live'`
 * bo'lganda Bridge so'rovlariga ruxsat beradi. Shu sababli "faqat Bridge'ni
 * yopish" amaliy jihatdan ilovani 'suspended' holatiga o'tkazish bilan bir xil
 * ta'sirga ega (katalogda ham ko'rinmay qoladi). Agar kelajakda faqat
 * Bridge-ga xos alohida bayroq kerak bo'lsa, App modeliga
 * `bridgeEnabled: Boolean` qo'shib shu middleware'da alohida tekshirish mumkin.
 */
const closeBridge = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 3) {
      throw new ValidationError('Yopish sababi kamida 3 belgidan iborat bo\'lishi kerak.');
    }

    const app = await App.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'suspended',
          'moderation.suspendedReason': `[Bridge API yopildi] ${reason}`,
          'moderation.reviewedBy': req.admin._id,
          'moderation.reviewedAt': new Date()
        }
      },
      { new: true }
    );
    if (!app) throw new AppError('Ilova topilmadi.', 404);

    await clearBridgeCache(app);

    logAdminAction({
      admin: req.admin,
      action: 'bridge.close',
      targetType: 'Bridge',
      targetId: app._id,
      description: `Bridge API yopildi: "${app.name}" — ${reason}`,
      meta: { reason, appUsername: app.username },
      ipAddress: req.ip
    });

    res.status(200).json({
      status: 'success',
      message: 'Bridge API kirishi darhol yopildi (keshlar tozalandi).',
      data: { app }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. BRIDGE API'NI QAYTA OCHISH
 */
const reopenBridge = async (req, res, next) => {
  try {
    const { id } = req.params;

    const app = await App.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'live',
          'moderation.suspendedReason': null,
          'moderation.reviewedBy': req.admin._id,
          'moderation.reviewedAt': new Date()
        }
      },
      { new: true }
    );
    if (!app) throw new AppError('Ilova topilmadi.', 404);

    await clearBridgeCache(app);

    logAdminAction({
      admin: req.admin,
      action: 'bridge.reopen',
      targetType: 'Bridge',
      targetId: app._id,
      description: `Bridge API qayta ochildi: "${app.name}"`,
      ipAddress: req.ip
    });

    res.status(200).json({ status: 'success', message: 'Bridge API kirishi qayta ochildi.', data: { app } });
  } catch (err) {
    next(err);
  }
};

/**
 * 5. ILOVA UCHUN BARCHA RUXSATNOMA KESHLARINI MAJBURIY TOZALASH
 * (auth:permissions:* — userlar ulanish/uzilishidagi kesh nomuvofiqligini
 * tezkor tuzatish uchun qo'l vositasi)
 */
const flushPermissionCache = async (req, res, next) => {
  try {
    const { id } = req.params;
    const app = await App.findById(id).select('name').lean();
    if (!app) throw new AppError('Ilova topilmadi.', 404);

    const keys = await redis.keys(`auth:permissions:*:${id}`);
    if (keys.length) await redis.del(keys);

    logAdminAction({
      admin: req.admin,
      action: 'bridge.flush_permission_cache',
      targetType: 'Bridge',
      targetId: id,
      description: `"${app.name}" uchun ${keys.length} ta ruxsatnoma keshi tozalandi.`,
      meta: { clearedKeys: keys.length },
      ipAddress: req.ip
    });

    res.status(200).json({ status: 'success', message: `${keys.length} ta kesh yozuvi tozalandi.` });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBridgeOverview,
  getAppBridgeStatus,
  closeBridge,
  reopenBridge,
  flushPermissionCache
};
