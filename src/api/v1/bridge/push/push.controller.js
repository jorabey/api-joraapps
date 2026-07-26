const { sendNotification } = require('../../../../services/notification.service');
const redis = require('../../../../config/redis');
const { ValidationError, AuthError } = require('../../../../utils/appErrors');

/**
 * 🚀 SEND PUSH NOTIFICATION (App to Server)
 * Tashqi ilovadan kelgan push so'rovini qabul qiladi va navbatga (Queue) tashlaydi.
 */
const sendPush = async (req, res, next) => {
  try {
    const { userId, title, body, url } = req.body;
    
    // req.appInfo oldingi 'verifyAppSignature' middleware'idan keladi
    const { _id: appId } = req.appInfo; 

    if (!userId || !title || !body) {
      throw new ValidationError('userId, title va body maydonlari majburiy.');
    }

    // 🔐 KRITIK XAVFSIZLIK: Ilova foydalanuvchiga xabar yuborish huquqiga egami?
    // 'connection.controller' yaratgan yuqori tezlikdagi keshni tekshiramiz
    const permissionCacheKey = `auth:permissions:${userId}:${appId}`;
    let permissions = await redis.get(permissionCacheKey);

    if (permissions) {
      permissions = JSON.parse(permissions);
    } else {
      // Agar keshda bo'lmasa (kamdan-kam holatda), bazani o'qish mantiqi:
      const UserAppConnection = require('../../../../models/UserAppConnection');
      const connection = await UserAppConnection.findOne({ userId, appId, status: 'connected' }).lean();
      
      if (!connection) {
        throw new AuthError('Ushbu foydalanuvchi ilovangizga ruxsat bermagan yoki aloqani uzgan.');
      }
      
      permissions = { isConnected: true, scopes: connection.scopes || [] };
      // Qayta keshga yozish (1 soatga)
      await redis.set(permissionCacheKey, JSON.stringify(permissions), 'EX', 3600);
    }

    // Xavfsizlik: Ilovada 'push' yoki 'notifications' scope'i borligini tekshirish
    if (!permissions.scopes.includes('send_notification')) {
      throw new AuthError('Ilovangizda push bildirishnoma yuborish ruxsati (scope) mavjud emas.');
    }

    // ⚡ ULTRA-FAST QUEUEING: Xabarni BullMQ (Redis) navbatiga qo'shish.
    // Bu operatsiya < 2ms vaqt oladi va Node.js Event Loop'ni umuman band qilmaydi.
    await sendNotification(userId, { title, body, url });

    // 202 Accepted: So'rov qabul qilindi va fonda bajariladi
    res.status(202).json({
      status: 'success',
      message: 'Bildirishnoma yuborish navbatga muvaffaqiyatli qo\'shildi.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendPush
};