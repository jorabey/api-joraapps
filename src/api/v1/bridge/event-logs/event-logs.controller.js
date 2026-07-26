const redis = require('../../../../config/redis');
const { ValidationError, AuthError } = require('../../../../utils/appErrors');

/**
 * 🚀 LOG EVENT RECEIVER (App to Server Telemetry Ingestion)
 * Tashqi ilova ichidagi foydalanuvchi harakatlarini asinxron qabul qilish va buferlash
 */
const logEvent = async (req, res, next) => {
  try {
    const { userId, eventType, metadata } = req.body;
    // req.appInfo avvalgi 'verifyAppSignature' middleware'i tomonidan yuklangan
    const { _id: appId } = req.appInfo; 

    // 1. TEZKOR VALIDATSIYA
    if (!userId || !eventType) {
      throw new ValidationError('userId va eventType maydonlari majburiy.');
    }

    // 2. PRIVACY SHIELD (Ruxsatnomani O(1) keshdan tekshirish):
    // Agar foydalanuvchi ilovani o'chirgan bo'lsa, ilova ushbu user uchun log yubora olmaydi!
    const permissionCacheKey = `auth:permissions:${userId}:${appId}`;
    let permissions = await redis.get(permissionCacheKey);

    if (permissions) {
      permissions = JSON.parse(permissions);
    } else {
      // Keshda bo'lmasa, bazadan compound index orqali faqat kerakli maydonni o'qiymiz
      const UserAppConnection = require('../../../../models/UserAppConnection');
      const connection = await UserAppConnection.findOne({ userId, appId, status: 'connected' }).lean();
      
      if (!connection) {
        throw new AuthError('Ushbu foydalanuvchi ilovangizga ruxsat bermagan yoki aloqani uzgan.');
      }
      permissions = { isConnected: true, scopes: connection.scopes || [] };
      await redis.set(permissionCacheKey, JSON.stringify(permissions), 'EX', 3600);
    }

    // 3. JONLI DAU ANALITIKASI (Redis HyperLogLog mexanizmi):
    // Kunlik faol foydalanuvchilar (DAU) ko'rsatkichini real-time hisoblash uchun PFADD buyrug'idan foydalanamiz.
    // Bu milliardlab userlar bo'lsa ham atigi 12KB xotira oladi va xotirada O(1) tezlikda noyoblikni o'lchaydi.
    const today = new Date().toISOString().split('T')[0];
    const dauKey = `analytics:app:${appId}:dau:${today}`;
    
    // Pipeline ishlatib, Redis tarmog'iga yuklamani kamaytirish mumkin
    const redisPipeline = redis.pipeline();
    redisPipeline.pfadd(dauKey, userId);
    redisPipeline.expire(dauKey, 172800); // 2 kun yashash muddati (Analytics worker o'qib olguncha)

    // 4. IN-MEMORY BATCH BUFERING (MongoDB yuklamasini bartaraf etish):
    // Loglarni to'g'ridan-to'g'ri bazaga yozmaymiz! Ularni tezkor Redis ro'yxatiga (Queue) otamiz.
    // Fonda ishlovchi background worker har 5 soniyada ushbu ro'yxatdan 5,000-10,000 ta logni paket holida 
    // sug'urib olib, bitta operatsiyada (insertMany) MongoDB'ga ommaviy yozadi.
    const logPayload = {
      appId,
      userId,
      eventType: eventType.trim(),
      metadata: metadata || {},
      timestamp: new Date()
    };

    redisPipeline.rpush('queue:event-logs', JSON.stringify(logPayload));
    
    // Parallel Redis buyruqlarini bitta tarmoq aylanmasida (Network Round-Trip) bajarish
    await redisPipeline.exec();

    // 5. 202 ACCEPTED PATTERN:
    // So'rov muvaffaqiyatli qabul qilindi va fonda xavfsiz qayta ishlanadi.
    // Tashqi ilova server javobini mutloq kutib o'tirmaydi (< 1ms response time).
    res.status(202).json({
      status: 'success',
      message: 'Log ma\'lumoti qabul qilindi va tahlil tizimiga uzatildi.'
    });

  } catch (err) {
    next(err);
  }
};

module.exports = {
  logEvent
};