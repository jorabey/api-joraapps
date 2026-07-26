const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const sanitizeMiddleware = require('./middlewares/sanitize');
const cookieParser = require('cookie-parser');
const compression = require('compression');

// --- Xavfsizlik va xatoliklarni boshqarish vositalari ---
const config = require('./config/env');
const errorHandler = require('./middlewares/errorHandler');
const connectDB = require('./config/database');
const { apiLimiterMiddleware } = require('./middlewares/rateLimiter');
const { AppError } = require('./utils/appErrors');

// --- Ruterlar ---
// Foydalanuvchilar (Client)
const clientAuthRoutes = require('./api/v1/client/auth/auth.route');
const clientUserRoutes = require('./api/v1/client/user/user.route');
const clientAppRoutes = require('./api/v1/client/apps/app.route');
const clientConnectionRoutes = require('./api/v1/client/connections/connection.route');

// Dasturchilar (Developer)
const devAuthRoutes = require('./api/v1/developer/auth/dev.auth.route');
const devMyAppsRoutes = require('./api/v1/developer/my-apps/my-apps.route');
const devAnalyticsRoutes = require('./api/v1/developer/analytics/analytics.route');
const devApiKeysRoutes = require('./api/v1/developer/api-keys/api-keys.route');

// Ilovalararo (Bridge)
const bridgePushRoutes = require('./api/v1/bridge/push/push.route');
const bridgeUserDataRoutes = require('./api/v1/bridge/user-data/user-data.route');
const bridgeEventLogsRoutes = require('./api/v1/bridge/event-logs/event-logs.route');

// Administratorlar (Admin Panel)
const adminAuthRoutes = require('./api/v1/admin/auth/admin.auth.route');
const adminDashboardRoutes = require('./api/v1/admin/dashboard/dashboard.route');
const adminAppsRoutes = require('./api/v1/admin/apps/admin.apps.route');
const adminDevelopersRoutes = require('./api/v1/admin/developers/admin.developers.route');
const adminUsersRoutes = require('./api/v1/admin/users/admin.users.route');
const adminReportsRoutes = require('./api/v1/admin/reports/admin.reports.route');
const adminBridgeRoutes = require('./api/v1/admin/bridge/admin.bridge.route');
const adminAuditLogsRoutes = require('./api/v1/admin/audit-logs/admin.audit-logs.route');
const seoRoutes = require('./api/v1/seo/seo.routes');

const app = express();

/**
 * ==========================================
 * 1. GLOBAL XAVFSIZLIK VA OPTIMIZATSIYA (SECURITY & PERF)
 * ==========================================
 */

// 1.1 HTTP Sarlavhalari mudofaasi (X-XSS-Protection, Clickjacking, va h.k.)
app.use(helmet());

// Cookie-parser middleware'ni routerlardan OLDIN qo'shing
app.use(cookieParser());

app.use(cors({
  origin: function (origin, callback) {
    callback(null, true); // Hammasiga ruxsat (faqat test uchun)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// 1.3 Payload Flooding (xotirani to'ldirish) mudofaasi
// Xakerlar megabaytlab JSON yuborib RAMni portlatishini to'sadi
app.use(express.json({ limit: '10kb' })); 
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 1.4 NoSQL Injection (Baza buzib kirilishi) mudofaasi
// Body yoki Query ichidagi '$', '.' belgilarni avtomat tozalaydi
app.use(sanitizeMiddleware);

// 1.5 HTTP Parameter Pollution (HPP) mudofaasi
// URL'da bir xil nomli parametrni qayta-qayta yuborib massiv yaratish (crash) xavfini kesadi
app.use(hpp());

// 1.6 Cookie boshqaruvi (Token Rotation / HttpOnly uchun)
app.use(cookieParser());

// 1.7 Tarmoq trafigini tejash (GZIP kompressiya)
// JSON javoblar hajmini 70-80% gacha kichraytirib, tarmoq o'tkazuvchanligini oshiradi
app.use(compression());



/**
 * ==========================================
 * 🚀 2. VERCEL SERVERLESS DATABASE GUARD MIDDLEWARE
 * ==========================================
 */
// Har qanday API so'rov routerlarga o'tishidan oldin ulanish tayyorligini tekshiradi va kutadi
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("Serverless DB Middleware xatosi:", err);
    res.status(500).json({
      status: 'error',
      message: 'Ma\'lumotlar bazasi bilan aloqa o\'rnatilmadi.',
      errorCode: 'DB_CONNECTION_TIMEOUT'
    });
  }
});


app.use('/', seoRoutes);

/**
 * ==========================================
 * 2. GLOBAL RATE LIMITING (SPAM MUDOFAASI)
 * ==========================================
 */
// Butun dastur bo'ylab Redis'ga asoslangan global qalqon
app.use('/api', apiLimiterMiddleware);

/**
 * ==========================================
 * 3. ROUTERLARNI YIG'ISH (API ENDPOINTS)
 * ==========================================
 */

// --- V1: CLIENT API (Foydalanuvchilar ekotizimi) ---
app.use('/api/v1/client/auth', clientAuthRoutes);
app.use('/api/v1/client/user', clientUserRoutes);
app.use('/api/v1/client/apps', clientAppRoutes);
app.use('/api/v1/client/connections', clientConnectionRoutes);

// --- V1: DEVELOPER API (Dasturchilar paneli) ---
app.use('/api/v1/developer/auth', devAuthRoutes);
app.use('/api/v1/developer/my-apps', devMyAppsRoutes);
app.use('/api/v1/developer/analytics', devAnalyticsRoutes);
app.use('/api/v1/developer/api-keys', devApiKeysRoutes);

// --- V1: BRIDGE API (Server to App aloqasi) ---
app.use('/api/v1/bridge/push', bridgePushRoutes);
app.use('/api/v1/bridge/user-data', bridgeUserDataRoutes);
app.use('/api/v1/bridge/event-logs', bridgeEventLogsRoutes);

// --- V1: ADMIN API (Boshqaruv paneli) ---
app.use('/api/v1/admin/auth', adminAuthRoutes);
app.use('/api/v1/admin/dashboard', adminDashboardRoutes);
app.use('/api/v1/admin/apps', adminAppsRoutes);
app.use('/api/v1/admin/developers', adminDevelopersRoutes);
app.use('/api/v1/admin/users', adminUsersRoutes);
app.use('/api/v1/admin/reports', adminReportsRoutes);
app.use('/api/v1/admin/bridge', adminBridgeRoutes);
app.use('/api/v1/admin/audit-logs', adminAuditLogsRoutes);



/**
 * ==========================================
 * 4. XATOLIKLARNI BOSHQARISH (ERROR HANDLING)
 * ==========================================
 */

// 4.1 Topilmagan manzillar (404 Not Found)
app.all(/(.*)/, (req, res, next) => {
  next(new AppError(`Ushbu manzil (${req.originalUrl}) serverda topilmadi!`, 404));
});

// 4.2 Global Xatolik ushlagich (Butun tizim crash bo'lishidan asraydi)
app.use(errorHandler);

module.exports = app;
