const redis = require('../config/redis');

/**
 * ⚡ REAL-TIME NOTIFICATION SOCKET HANDLER
 * Har bir faol foydalanuvchining ulanish oqimini xavfsiz boshqarish
 */
const registerNotificationHandlers = (io, socket) => {
  // socket.user ob'ekti 'socket.js' dagi ulanishgacha bo'lgan JWT middleware'dan keladi
  const userId = socket.user?._id?.toString();

  if (!userId) {
    socket.disconnect(true); // Autentifikatsiyadan o'tmaganlarni shafqatsiz uzamiz
    return;
  }

  /**
   * 1. 🔐 SECURITY ISOLATION CHANNELS (Room-based routing)
   * Foydalanuvchini faqat uning shaxsiy ID'siga tegishli maxfiy "xonaga" joylashtiramiz.
   * Bu milliardlab foydalanuvchilar ichidan kerakli odamni O(1) tezlikda topish imkonini beradi.
   * Bir nechta qurilmadan (PC, Telefon) kirsa, barchasi bitta xonaga birlashadi.
   */
  socket.join(`user:room:${userId}`);

  // Foydalanuvchi tarmoqqa kirdi (Jonli hisoblagichlarni keshda yangilash yoki status)
  trackUserStatus(userId, 'online');

  /**
   * 2. CLIENT ACKNOWLEDGEMENT (Xabarni tasdiqlash eventi)
   * Foydalanuvchi xabarni o'qiganida frontenddan keladigan tezkor signalni ushlash
   */
  socket.on('notification:read', async (data) => {
    try {
      const { notificationId } = data;
      if (!notificationId) return;

      // Xabarni o'qildi holatiga keltirish mantiqini navbatga (Queue) yoki fon ishchisiga otish
      // Bu yerda og'ir DB operatsiyasi bajarilmaydi, faqat Redis buyrug'i berilishi mumkin
      await redis.publish('notification:events', JSON.stringify({
        type: 'READ',
        userId,
        notificationId
      }));
    } catch (err) {
      // Socket xatoliklarini errorHandlerga uzatib serverni crash bo'lishidan asraymiz
      socket.emit('error', { message: 'Xabar holatini o\'zgartirishda xatolik.' });
    }
  });

  /**
   * 3. 🚨 CLEAN DISCONNECT & MEMORY PURGE
   * Foydalanuvchi tarmoqdan uzilganda xotirani zudlik bilan tozalash.
   * Hech qanday massiv yoki ob'ektda "eski izlar" qolmasligi shart.
   */
  socket.on('disconnect', () => {
    // Qurilma tarmoqdan uzildi, xonadan chiqish avtomatik bajariladi.
    trackUserStatus(userId, 'offline');
  });
};

/**
 * HELPER: Foydalanuvchining onlayn/offlayn ko'rsatkichini Redis bitset yoki keshda yangilash
 * @desc Millionlab parallel foydalanuvchilar statusini O(1) vaqt ichida boshqaradi
 */
const trackUserStatus = async (userId, status) => {
  const statusKey = `user:status:${userId}`;
  if (status === 'online') {
    await redis.set(statusKey, 'online', 'EX', 300); // 5 daqiqalik yashash muddati (Heartbeat)
  } else {
    await redis.del(statusKey);
  }
};

module.exports = {
  registerNotificationHandlers
};