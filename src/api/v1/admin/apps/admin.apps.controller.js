const App = require('../../../../models/App');
const AppReport = require('../../../../models/AppReport');
const UserAppConnection = require('../../../../models/UserAppConnection');
const redis = require('../../../../config/redis');
const { paginate } = require('../../../../utils/pagination');
const { AppError } = require('../../../../utils/appErrors');
const { logAdminAction } = require('../../../../utils/auditLog');

/**
 * Bitta ilovaga tegishli barcha keshlarni tozalash — admin har qanday
 * status/ma'lumot o'zgarishidan keyin shuni chaqiradi, aks holda eski
 * holat Bridge API yoki katalogda keshdan o'qilishda davom etadi.
 */
const clearAppCache = async (app) => {
  try {
    await Promise.all([
      redis.del(`app:details:${app.username.toLowerCase()}`),
      redis.del(`app:data:${app.appToken}`),
      redis.del(`app_secret:${app.appToken}`),
      redis.keys('apps:list:page:*').then((keys) => keys.length && redis.del(keys))
    ]);
  } catch (err) {
    console.error('⚠️ Ilova keshini tozalashda xatolik:', err.message);
  }
};

/**
 * 1. BARCHA ILOVALAR RO'YXATI — filtr, qidiruv, status, kategoriya
 */
const listApps = async (req, res, next) => {
  try {
    const { page, limit, status, category, q, sortBy } = req.query;

    const query = {};
    if (status && status !== 'all') query.status = status;
    if (category && category !== 'all') query.category = category;
    if (q) query.$text = { $search: q };

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      rating: { 'rating.average': -1 },
      mau: { 'stats.mau': -1 },
      name: { name: 1 }
    };

    const result = await paginate(App, query, {
      page, limit,
      sort: sortMap[sortBy] || sortMap.newest,
      select: 'name username description iconUrl status category isVerified stats rating moderation developerId createdAt'
    });

    // developerId'ni populate qilmasdan emas, lean+paginate dan keyin alohida to'ldiramiz
    // (paginate util populate qabul qilmaydi — App ro'yxati uchun developerId kerak bo'lsa frontendda alohida so'raladi)

    res.status(200).json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. BITTA ILOVA TO'LIQ MA'LUMOTI (developer va shikoyatlar bilan)
 */
const getAppDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const app = await App.findById(id).populate('developerId', 'fullName companyName email status').lean();
    if (!app) throw new AppError('Ilova topilmadi.', 404);

    const [reportsCount, activeConnections, recentReports] = await Promise.all([
      AppReport.countDocuments({ appId: id }),
      UserAppConnection.countDocuments({ appId: id, status: 'connected' }),
      AppReport.find({ appId: id }).sort({ createdAt: -1 }).limit(10)
        .populate('reporterId', 'username firstName lastName').lean()
    ]);

    res.status(200).json({
      status: 'success',
      data: { app, reportsCount, activeConnections, recentReports }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. TEKSHIRUVDAN O'TKAZISH — TASDIQLASH (under_review → live)
 */
const approveApp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category, isVerified } = req.body;

    const updateData = {
      status: 'live',
      'moderation.reviewedBy': req.admin._id,
      'moderation.reviewedAt': new Date(),
      'moderation.rejectedReason': null
    };
    if (category) updateData.category = category;
    if (typeof isVerified === 'boolean') updateData.isVerified = isVerified;

    const app = await App.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    if (!app) throw new AppError('Ilova topilmadi.', 404);

    await clearAppCache(app);

    logAdminAction({
      admin: req.admin,
      action: 'app.approve',
      targetType: 'App',
      targetId: app._id,
      description: `"${app.name}" ilovasi tasdiqlandi va faollashtirildi (live).`,
      meta: { category: app.category, isVerified: app.isVerified },
      ipAddress: req.ip
    });

    res.status(200).json({ status: 'success', message: 'Ilova tasdiqlandi va faollashtirildi.', data: { app } });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. TEKSHIRUVDAN RAD ETISH (under_review → suspended, sabab bilan)
 * Eslatma: rad etilgan ilova uchun alohida "rejected" statusi modelda yo'q,
 * shu sababli rad etish "suspended" + rejectedReason orqali ifodalanadi —
 * bu dasturchiga aniq tushuntirish bilan ilovani yashirin holatga o'tkazadi.
 */
const rejectApp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const app = await App.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'suspended',
          'moderation.rejectedReason': reason,
          'moderation.reviewedBy': req.admin._id,
          'moderation.reviewedAt': new Date()
        }
      },
      { new: true }
    );
    if (!app) throw new AppError('Ilova topilmadi.', 404);

    await clearAppCache(app);

    logAdminAction({
      admin: req.admin,
      action: 'app.reject',
      targetType: 'App',
      targetId: app._id,
      description: `"${app.name}" ilovasi rad etildi: ${reason}`,
      meta: { reason },
      ipAddress: req.ip
    });

    res.status(200).json({ status: 'success', message: 'Ilova rad etildi.', data: { app } });
  } catch (err) {
    next(err);
  }
};

/**
 * 5. ILOVANI TO'XTATISH / BLOKLASH (live → suspended)
 * Bu Bridge API'ni ham darhol yopadi (verifyAppSignature status='live'
 * bo'lmasa rad etadi) va keshni tozalaganimiz sababli ta'sir bir zumda bo'ladi.
 */
const suspendApp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const app = await App.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'suspended',
          'moderation.suspendedReason': reason,
          'moderation.reviewedBy': req.admin._id,
          'moderation.reviewedAt': new Date()
        }
      },
      { new: true }
    );
    if (!app) throw new AppError('Ilova topilmadi.', 404);

    await clearAppCache(app);

    logAdminAction({
      admin: req.admin,
      action: 'app.suspend',
      targetType: 'App',
      targetId: app._id,
      description: `"${app.name}" to'xtatildi (Bridge API yopildi): ${reason}`,
      meta: { reason },
      ipAddress: req.ip
    });

    res.status(200).json({
      status: 'success',
      message: 'Ilova to\'xtatildi. Bridge API kirishi darhol yopildi.',
      data: { app }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 6. ILOVANI TIKLASH (suspended → live)
 */
const restoreApp = async (req, res, next) => {
  try {
    const { id } = req.params;

    const app = await App.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'live',
          'moderation.suspendedReason': null,
          'moderation.rejectedReason': null,
          'moderation.reviewedBy': req.admin._id,
          'moderation.reviewedAt': new Date()
        }
      },
      { new: true }
    );
    if (!app) throw new AppError('Ilova topilmadi.', 404);

    await clearAppCache(app);

    logAdminAction({
      admin: req.admin,
      action: 'app.restore',
      targetType: 'App',
      targetId: app._id,
      description: `"${app.name}" qayta faollashtirildi (live).`,
      ipAddress: req.ip
    });

    res.status(200).json({ status: 'success', message: 'Ilova qayta faollashtirildi.', data: { app } });
  } catch (err) {
    next(err);
  }
};

/**
 * 7. KATEGORIYANI O'ZGARTIRISH
 */
const setCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category } = req.body;

    const app = await App.findByIdAndUpdate(id, { $set: { category } }, { new: true });
    if (!app) throw new AppError('Ilova topilmadi.', 404);

    await clearAppCache(app);

    logAdminAction({
      admin: req.admin,
      action: 'app.set_category',
      targetType: 'App',
      targetId: app._id,
      description: `"${app.name}" kategoriyasi: ${category}`,
      ipAddress: req.ip
    });

    res.status(200).json({ status: 'success', message: 'Kategoriya yangilandi.', data: { app } });
  } catch (err) {
    next(err);
  }
};

/**
 * 8. TASDIQLANGAN BELGISINI BERISH / OLISH (isVerified toggle)
 */
const setVerified = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isVerified } = req.body;

    const app = await App.findByIdAndUpdate(id, { $set: { isVerified } }, { new: true });
    if (!app) throw new AppError('Ilova topilmadi.', 404);

    await clearAppCache(app);

    logAdminAction({
      admin: req.admin,
      action: isVerified ? 'app.verify' : 'app.unverify',
      targetType: 'App',
      targetId: app._id,
      description: `"${app.name}" tasdiqlanganlik belgisi: ${isVerified}`,
      ipAddress: req.ip
    });

    res.status(200).json({ status: 'success', message: 'Tasdiqlanganlik holati yangilandi.', data: { app } });
  } catch (err) {
    next(err);
  }
};

/**
 * 9. ILOVANI BUTUNLAY O'CHIRISH (platformadan + barcha bog'liq ma'lumotlar)
 */
const deleteApp = async (req, res, next) => {
  try {
    const { id } = req.params;

    const app = await App.findById(id).lean();
    if (!app) throw new AppError('Ilova topilmadi.', 404);

    await Promise.all([
      App.findByIdAndDelete(id),
      UserAppConnection.deleteMany({ appId: id }),
      AppReport.deleteMany({ appId: id })
    ]);

    await clearAppCache(app);

    logAdminAction({
      admin: req.admin,
      action: 'app.delete',
      targetType: 'App',
      targetId: id,
      description: `"${app.name}" (@${app.username}) platformadan butunlay o'chirildi.`,
      ipAddress: req.ip
    });

    res.status(200).json({
      status: 'success',
      message: 'Ilova, ulanishlar va shikoyatlar butunlay o\'chirildi.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listApps,
  getAppDetail,
  approveApp,
  rejectApp,
  suspendApp,
  restoreApp,
  setCategory,
  setVerified,
  deleteApp
};
