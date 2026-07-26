const App = require('../../../../models/App');
const UserAppConnection = require('../../../../models/UserAppConnection');
const redis = require('../../../../config/redis');
const { ValidationError, AppError } = require('../../../../utils/appErrors');

/**
 * 1. ALOHIDA ILOVA STATISTIKASINI OLISH (Get Single App Analytics)
 * @desc MAU, DAU, umumiy o'rnatishlar va ruxsatnomalar tahlili
 */
const getAppAnalytics = async (req, res, next) => {
  try {
    const { appId } = req.params;
    const developerId = req.developer._id; // requireDevAuth middleware'idan keladi

    if (!appId) throw new ValidationError('Ilova identifikatori (appId) shart.');

    const cacheKey = `analytics:app:${appId}:dev:${developerId}`;
    
    // 1-MUDOFAA: Redis Live Dashboard Caching (< 1ms). 
    // Dasturchi sahifani tinmay yangilasa ham bazaga yuklama tushmaydi.
    const cachedAnalytics = await redis.get(cacheKey);
    if (cachedAnalytics) {
      return res.status(200).json({
        status: 'success',
        source: 'cache',
        data: JSON.parse(cachedAnalytics)
      });
    }

    // 2-MUDOFAA (Strict Isolation): Faqat joriy dasturchiga tegishli ilovani qidirish
    // .lean() va aniq field-selection orqali xotira sarfini 90% ga qisqartiramiz
    const app = await App.findOne({ _id: appId, developerId })
      .select('name username stats rating status createdAt')
      .lean();

    if (!app) {
      throw new AppError('Ilova topilmadi yoki sizda tahlillarni ko\'rish huquqi yo\'q.', 403);
    }

    // Murakkab va og'ir hisob-kitoblarni pre-aggregated (oldindan tayyor) holda model ichidan olamiz.
    // Misol uchun, Scopes (ruxsatnomalar) bo'yicha foydalanuvchilar taqsimoti:
    const activeConnectionsCount = await UserAppConnection.countDocuments({ appId, status: 'active' });

    const analyticsData = {
      appId: app._id,
      name: app.name,
      username: app.username,
      status: app.status,
      metrics: {
        totalDownloads: app.stats?.downloads || 0,
        monthlyActiveUsers: app.stats?.mau || 0, // Redis HyperLogLog yoki Cron orqali pre-computed qilingan
        liveConnections: activeConnectionsCount
      },
      rating: {
        average: app.rating?.average || 0,
        count: app.rating?.count || 0
      },
      generatedAt: new Date()
    };

    // Tahliliy ma'lumotlarni 5 daqiqaga keshga qo'yamiz (Dashboardlar uchun ideal muddat)
    await redis.set(cacheKey, JSON.stringify(analyticsData), 'EX', 300);

    res.status(200).json({
      status: 'success',
      source: 'database',
      data: analyticsData
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. DASTURCHINING BARCHA ILOVALARI UCHUN UMUMIY PANEL (Get Overview Analytics)
 * @desc Barcha ilovalarning jami ko'rsatkichlarini yig'ish va tahlil qilish
 */
const getOverviewAnalytics = async (req, res, next) => {
  try {
    const developerId = req.developer._id;
    const cacheKey = `analytics:overview:dev:${developerId}`;

    const cachedOverview = await redis.get(cacheKey);
    if (cachedOverview) {
      return res.status(200).json({
        status: 'success',
        source: 'cache',
        data: JSON.parse(cachedOverview)
      });
    }

    // Developerga tegishli barcha faol ilovalarni lean holatda massivga yig'amiz
    const apps = await App.find({ developerId })
      .select('name stats rating')
      .lean();

    let totalDownloads = 0;
    let totalMau = 0;
    const topApps = [];

    // O(N) murakkablikda elementlarni bitta siklda yig'amiz (Database darajasidagi og'ir $group operatsiyalaridan qochamiz)
    apps.forEach(app => {
      const downloads = app.stats?.downloads || 0;
      const mau = app.stats?.mau || 0;

      totalDownloads += downloads;
      totalMau += mau;

      topApps.push({
        name: app.name,
        downloads,
        mau,
        rating: app.rating?.average || 0
      });
    });

    // Eng ommabop ilovalarni saralash (Xotirada tezkor array sort)
    topApps.sort((a, b) => b.mau - a.mau);

    const overviewData = {
      totalApps: apps.length,
      aggregateMetrics: {
        totalDownloads,
        totalPlatformMau: totalMau
      },
      topPerformingApps: topApps.slice(0, 5), // Eng kuchli 5 ta ilova
      updatedAt: new Date()
    };

    // 10 daqiqaga keshga saqlash
    await redis.set(cacheKey, JSON.stringify(overviewData), 'EX', 600);

    res.status(200).json({
      status: 'success',
      source: 'database',
      data: overviewData
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAppAnalytics,
  getOverviewAnalytics
};