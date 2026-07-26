const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const redisClient = require('../config/redis'); // Asosiy Redis ulanishi
const { registerNotificationHandlers } = require('./notification.handlers');

let ioInstance = null;

/**
 * 🚀 SOCKET.IO POYDEVORINI ISHGA TUSHIRISH
 * @param {Object} server - HTTP Server ob'ekti (server.js dan keladi)
 */
const initSocket = (server) => {
  // 1. O'TA REJALI SOZLAMALAR BILAN SERVERNI QURISH
  ioInstance = new Server(server, {
    cors: {
      origin: config.cors.allowedOrigins || '*', // Faqat tasdiqlangan domenlar (CORS Protection)
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 20000,  // 20 soniya ichida heartbeat kelmasa, ulanishni yopish (Xotirani tejash)
    pingInterval: 10000, // Har 10 soniyada aloqa barqarorligini tekshirish
    transports: ['websocket'] // 🔥 ULTRA-SPEED: HTTP Long-Polling yuklamasini o'chirib, faqat WebSocket'ni majburlash
  });

  // 2. MULTI-INSTANCE CLUSTERING (Redis Adapter orqali gorizontal kengayish):
  // Redis ulanishini dublikat qilib, xabarlarni tinglash (SUBSCRIBE) uchun ajratamiz
  const pubClient = redisClient;
  const subClient = redisClient.duplicate();

  ioInstance.adapter(createAdapter(pubClient, subClient));

  // 3. HANDSHAKE MIDDLEWARE (Eng birinchi xavfsizlik darvozasi):
  // Soket ulanish oqimi Node.js xotirasini band qilishidan oldin token tekshiriladi
  ioInstance.use(async (socket, next) => {
    try {
      // Tokenni 'auth' payload'dan yoki sarlavhalardan (Headers) xavfsiz sug'urib olish
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Autentifikatsiya rad etildi: Token topilmadi.'));
      }

      // Kalit so'z orqali shifrni tekshirish
      const decoded = jwt.verify(token, config.jwt.accessSecret);

      // 🔐 BILLION-SCALE OPTIMIZATION:
      // Soket har safar ulanayotganda MongoDB bazasiga borib foydalanuvchini qidirmaymiz!
      // JWT imzosiga ishonamiz va faqat zarur ID'ni soket xotirasiga biriktiramiz.
      socket.user = { _id: decoded.id };

      next();
    } catch (err) {
      // Noto'g'ri tokenli ulanishlarni controller qatlamiga o'tkazmay rad etish
      return next(new Error('Autentifikatsiya rad etildi: Yaroqsiz token.'));
    }
  });

  // 4. KANAL ULANISHLARI VA LIFECYCLE MANAGEMENT
  ioInstance.on('connection', (socket) => {
    // Har bir ulanish uchun handlerlarni modulli ro'yxatdan o'tkazish
    registerNotificationHandlers(ioInstance, socket);
  });

  return ioInstance;
};

/**
 * ⚡ INSTANCE GETTER (Circular Dependency To'sig'i)
 * Tizimning boshqa qismlari (masalan, Bridge API yoki fon workerlari) 
 * foydalanuvchiga real-time push jo'natmoqchi bo'lsa, ushbu funksiyadan foydalanadi.
 */
const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.io hali ishga tushirilmagan!');
  }
  return ioInstance;
};

module.exports = {
  initSocket,
  getIO
};