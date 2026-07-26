const crypto = require('crypto');
const App = require('../models/App');
const redis = require('../config/redis');
const { AuthError } = require('../utils/appErrors');

const ALGORITHM = 'aes-256-cbc';

const getEncryptionKey = () => {
  const secret = process.env.MASTER_ENCRYPTION_KEY || 'jora_apps_default_secure_key_32_bytes';
  return crypto.createHash('sha256').update(String(secret)).digest();
};

const decryptSecret = (encryptedData) => {
  try {
    const [ivHex, encryptedHex] = encryptedData.split(':');
    if (!ivHex || !encryptedHex) return null;
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return null;
  }
};

const verifyAppSignature = async (req, res, next) => {
  try {
    const appToken = req.headers['x-app-token'];
    const signature = req.headers['x-app-signature'];
    const timestamp = req.headers['x-app-timestamp'];

    if (!appToken || !signature || !timestamp) {
      throw new AuthError('Ilova autentifikatsiyasi uchun signature yetishmayapti.');
    }

    // 1. Replay attack himoyasi
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 30) {
      throw new AuthError('So\'rov muddati o\'tgan (Timestamp expired).');
    }

    // 2. 🚀 PERFORMANCE & DATA INTEGRATION: To'liq ilovani keshdan/bazadan olish
    let appData = await redis.get(`app:data:${appToken}`);
    let app;
    
    if (appData) {
      app = JSON.parse(appData);
    } else {
      app = await App.findOne({ appToken }).select('+appSecret').lean();
      if (!app) throw new AuthError('Ilova topilmadi.');
      
      // Ilovani keshga 1 soatga yozib qo'yamiz (updateApp buni avtomat tozalaydi)
      await redis.set(`app:data:${appToken}`, JSON.stringify(app), 'EX', 3600);
    }

    // 🔐 ADMIN NAZORATI: Agar admin ilovani suspend qilgan bo'lsa yoki ilova
    // hali "live" holatiga o'tmagan bo'lsa, Bridge API darhol rad etilishi kerak.
    // (Eslatma: bu tekshiruv ilgari yo'q edi — suspend qilingan ilova ham
    // signature to'g'ri bo'lsa Bridge orqali ishlay olardi.)
    if (app.status !== 'live') {
      throw new AuthError('Ushbu ilova hozircha faol emas (suspended yoki tasdiqlanmagan). Bridge API yopilgan.');
    }

    // 🔐 KRITIK: Controller `req.appInfo._id` ni o'qiy olishi uchun obyektni yuklaymiz
    req.appInfo = app; 
    const encryptedSecret = app.appSecret;

    // 3. Bazadagi/Keshdagi shifrlangan kalitni AES Decrypt qilish
    const rawAppSecret = decryptSecret(encryptedSecret);
    if (!rawAppSecret) {
      throw new AuthError('Tizim xavfsizlik kalitini ochishda xatolik yuz berdi.');
    }

    // 4. Signature ni qayta hisoblash
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', rawAppSecret)
      .update(payload + timestamp)
      .digest('hex');

    // 5. Timing-safe comparison
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      throw new AuthError('Invalid signature.');
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = verifyAppSignature;