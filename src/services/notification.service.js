const webPush = require('web-push');
const { Queue } = require('bullmq');
const redisConfig = require('../config/redis'); // Redis connection
const config = require('../config/env');

// VAPID kalitlari: Web Push xavfsizligi uchun (Browser validation)
webPush.setVapidDetails(
  'mailto:support@appstore.uz',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Redis asosidagi "Notification Queue" (Navbat)
const notificationQueue = new Queue('notifications', {
  connection: redisConfig // Redis ulanishi
});

/**
 * Notification Service: Xabarlarni qabul qiladi va navbatga qo'shadi.
 * Bu milliardlab user uchun eng tezkor yo'l.
 */
const sendNotification = async (userId, payload) => {
  try {
    // 1. Bazani ifloslantirmaslik uchun tekshiruv
    if (!userId || !payload) return;

    // 2. Queue (Navbat) ga qo'shish
    // Bu operatsiya 1ms dan kam vaqt oladi.
    await notificationQueue.add('send_notification', {
      userId,
      title: payload.title,
      body: payload.body,
      url: payload.url || '/',
      timestamp: Date.now()
    }, {
      attempts: 3, // Agar yuborishda xato bo'lsa, 3 marta qayta urinish
      backoff: { type: 'exponential', delay: 1000 } // Sekin-asta qayta urinish
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Notification Queue error:', error);
    throw new Error('Bildirishnoma yuborish navbatida xatolik.');
  }
};

module.exports = { sendNotification };