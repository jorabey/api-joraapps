const { Worker } = require('bullmq');
const redisClient = require('../config/redis');
const webPush = require('web-push');

// 1. Worker konfiguratsiyasi
const worker = new Worker('notifications', async (job) => {
  const { userId, title, body, url } = job.data;

  try {
    // 2. Foydalanuvchining push obunalarini (subscriptions) bazadan olish
    // Eslatma: Haqiqiy loyihada bu yerda 'Subscription' modelidan olamiz
    // const subscription = await Subscription.findOne({ userId });
    
    const subscription = await getPushSubscriptionFromDB(userId); 

    if (subscription) {
      // 3. Xabarni yuborish
      await webPush.sendNotification(
        subscription,
        JSON.stringify({ title, body, url })
      );
    }
  } catch (error) {
    // 4. Xatoliklarni boshqarish: 
    // Agar xabar yuborishda xato bo'lsa, BullMQ avtomatik retry qiladi
    console.error(`❌ Worker yuborishda xato [Job: ${job.id}]:`, error.message);
    throw error; // Xatolikni tashlash orqali BullMQ ga "retry" qilishni buyuramiz
  }
}, { 
  connection: redisClient,
  concurrency: 50, // Bir vaqtning o'zida 50 ta xabarni qayta ishlash (Server quvvatiga qarab oshirish mumkin)
  lockDuration: 30000 // 30 soniya blokirovka
});

// 5. Monitoring
worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} muvaffaqiyatli bajarildi.`);
});

worker.on('failed', (job, err) => {
  console.error(`🔥 Job ${job.id} bajarilmadi:`, err.message);
});

// Helper funksiya (DB dan olish)
async function getPushSubscriptionFromDB(userId) {
  // Bu yerda DB ga murojaat qilasiz
  return null; 
}

module.exports = worker;