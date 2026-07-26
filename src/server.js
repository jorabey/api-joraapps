const http = require('http');
const app = require('./app');
const config = require('./config/env');
const connectDB = require('./config/database');
const redisClient = require('./config/redis');
const { initSocket } = require('./websockets/socket');

// 1. O'tkir Xatoliklarni Tutish (Eng birinchi yoziladi!)
// Agar loyihaning biron joyida xatosi ushlanmagan sinxron kod bo'lsa, Node.js yopilib qoladi.
// Biz buni loglarga yozib, keyin xavfsiz to'xtatamiz.
process.on('uncaughtException', (err) => {
  console.error('🚨 UNCAUGHT EXCEPTION! Dastur favqulodda to\'xtatilmoqda...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

// Express ilovasini Node.js ning o'z HTTP serveriga o'raymiz (Socket.io uchun kerak)
const server = http.createServer(app);

// Socket.io arxitekturasini ishga tushirish va HTTP serverga bog'lash
initSocket(server);

let serverInstance;

/**
 * 🚀 ASOSIY ISHGA TUSHIRISH SIKLI (Boot Sequence)
 */
const startServer = async () => {
  try {
    await redisClient.ping();
    console.log('✅ Redis PING javobi olindi!');
} catch (e) {
    console.error('❌ Redis PING xatosi:', e.message);
}
  try {
    // 2. Ma'lumotlar bazalarini parallel asinxron ulash
    console.log('🔄 Barcha infratuzilmalarga ulanish boshlandi...');
    
    // MongoDB ulanishini kutamiz (Eng muhimi)
    await connectDB();
    
    // Redis allaqachon 'config/redis.js' da ulangan, shunchaki test ping yuboramiz
    if (redisClient.status === 'ready') {
      console.log('✅ Redis xotirasi bilan aloqa muvaffaqiyatli.');
    } else {
      console.warn('⚠️ Redis hozircha ulanmagan, lekin fonda ulanishga harakat qilmoqda...');
    }

    // 3. Tarmoqni tinglashni boshlash
    serverInstance = server.listen(config.port, () => {
      console.log(`\n🚀 Server Muvaffaqiyatli Ishga Tushdi!`);
      console.log(`🌐 Muhit: ${config.env.toUpperCase()}`);
      console.log(`🔌 Port: ${config.port}\n`);
    });

  } catch (error) {
    console.error('❌ Serverni ishga tushirishda mudhish xatolik:', error);
    process.exit(1);
  }
};

startServer();

/**
 * 🛡️ XAVFSIZ TO'XTATISH MEXANIZMLARI (Graceful Shutdown)
 */

// Agar biron Promiseni 'catch' qilish esdan chiqqan bo'lsa:
process.on('unhandledRejection', (err) => {
  console.error('🚨 UNHANDLED REJECTION! Dastur xavfsiz tarzda to\'xtatilmoqda...');
  console.error(err.name, err.message);
  
  if (serverInstance) {
    serverInstance.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Docker, Kubernetes yoki PM2 serverni to'xtatmoqchi bo'lganda (SIGTERM signali)
// Server darhol o'lib qolmasligi va joriy foydalanuvchilarning amallari uzilib qolmasligi uchun kutamiz:
process.on('SIGTERM', () => {
  console.info('🛑 SIGTERM signali qabul qilindi. Yangi ulanishlar to\'xtatilmoqda...');
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('💤 Barcha tarmoq oqimlari yakunlandi. Server uyquga ketdi.');
    });
  }
});