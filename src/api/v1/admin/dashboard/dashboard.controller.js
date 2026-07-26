const User = require('../../../../models/User');
const Developer = require('../../../../models/Developer');
const App = require('../../../../models/App');
const AppReport = require('../../../../models/AppReport');
const UserAppConnection = require('../../../../models/UserAppConnection');
const AuditLog = require('../../../../models/AuditLog');

/**
 * 1. UMUMIY KO'RSATKICHLAR (Overview)
 * Platforma bo'ylab live statistika — kartochkalar uchun.
 */
const getOverview = async (req, res, next) => {
  try {
    const [
      totalUsers, blockedUsers,
      totalDevelopers, pendingDevelopers, activeDevelopers,
      totalApps, liveApps, underReviewApps, suspendedApps,
      pendingReports,
      totalConnections
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isBlocked: true }),
      Developer.countDocuments(),
      Developer.countDocuments({ status: 'pending_review' }),
      Developer.countDocuments({ status: 'active' }),
      App.countDocuments(),
      App.countDocuments({ status: 'live' }),
      App.countDocuments({ status: 'under_review' }),
      App.countDocuments({ status: 'suspended' }),
      AppReport.countDocuments({ status: 'pending' }),
      UserAppConnection.countDocuments({ status: 'connected' })
    ]);

    // 24 soat ichida ro'yxatdan o'tgan yangi userlar/devlar (kunlik o'sish hissi uchun)
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [newUsers24h, newDevelopers24h, newApps24h] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: since24h } }),
      Developer.countDocuments({ createdAt: { $gte: since24h } }),
      App.countDocuments({ createdAt: { $gte: since24h } })
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        users: { total: totalUsers, blocked: blockedUsers, new24h: newUsers24h },
        developers: {
          total: totalDevelopers,
          pendingReview: pendingDevelopers,
          active: activeDevelopers,
          new24h: newDevelopers24h
        },
        apps: {
          total: totalApps,
          live: liveApps,
          underReview: underReviewApps,
          suspended: suspendedApps,
          new24h: newApps24h
        },
        reports: { pending: pendingReports },
        connections: { totalActive: totalConnections },
        generatedAt: new Date()
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. SO'NGGI FAOLLIK OQIMI (Recent activity feed)
 * Bosh sahifada "so'nggi voqealar" ro'yxati uchun — yangi ro'yxatdan
 * o'tishlar, yangi ilovalar, kutilayotgan shikoyatlar aralashtirilgan holda.
 */
const getRecentActivity = async (req, res, next) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 20);

    const [recentApps, recentReports, recentDevelopers, recentAuditLogs] = await Promise.all([
      App.find().sort({ createdAt: -1 }).limit(limit).select('name username status iconUrl createdAt').lean(),
      AppReport.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(limit)
        .populate('appId', 'name username').select('reason appId createdAt').lean(),
      Developer.find().sort({ createdAt: -1 }).limit(limit).select('fullName companyName email status createdAt').lean(),
      AuditLog.find().sort({ createdAt: -1 }).limit(limit).lean()
    ]);

    res.status(200).json({
      status: 'success',
      data: { recentApps, recentReports, recentDevelopers, recentAuditLogs }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. O'SISH TENDENSIYASI (kunlik, oxirgi N kun) — grafik uchun
 */
const getGrowthTrend = async (req, res, next) => {
  try {
    const days = Math.min(90, parseInt(req.query.days) || 14);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const dayBucket = (dateField) => ({
      $dateToString: { format: '%Y-%m-%d', date: `$${dateField}` }
    });

    const [userTrend, appTrend, developerTrend] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: dayBucket('createdAt'), count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      App.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: dayBucket('createdAt'), count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      Developer.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: dayBucket('createdAt'), count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ])
    ]);

    res.status(200).json({
      status: 'success',
      data: { days, userTrend, appTrend, developerTrend }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getOverview, getRecentActivity, getGrowthTrend };
