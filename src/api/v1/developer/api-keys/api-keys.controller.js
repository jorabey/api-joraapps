const App = require('../../../../models/App');
const redis = require('../../../../config/redis');
const crypto = require('crypto');
const { ValidationError, AppError } = require('../../../../utils/appErrors');

/**
 * 1. API KALITLARINI KO'RISH (Get API Keys)
 * @desc Ilovaning maxfiy token va secret kalitlarini xavfsiz yuklash
 */
const getApiKeys = async (req, res, next) => {
  try {
    const { appId } = req.params;
    const developerId = req.developer._id; // requireDevAuth middleware'idan keladi

    if (!appId) throw new ValidationError('Ilova identifikatori (appId) shart.');

    // 🚀 STRICT ISOLATION: Faqat joriy developerga tegishli ilovani qidirish
    // Modelda 'select: false' qilingan maxfiy maydonlarni qat'iy chaqirib olamiz
    const app = await App.findOne({ _id: appId, developerId })
      .select('name appToken +appSecret')
      .lean();

    if (!app) {
      throw new AppError('Ilova topilmadi yoki kalitlarni ko\'rish huquqiga ega emassiz.', 403);
    }

    res.status(200).json({
      status: 'success',
      data: {
        appToken: app.appToken,
        appSecret: app.appSecret // Faqat tasdiqlangan dasturchining o'zigagina ko'rsatiladi
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. API KALITLARINI YANGILASH / ROTATSIYA (Regenerate API Keys)
 * @desc Kriptografik yangi kalitlar yaratish va eski kalit keshlarini darhol yo'q qilish
 */
const regenerateApiKeys = async (req, res, next) => {
  try {
    const { appId } = req.params;
    const developerId = req.developer._id;

    if (!appId) throw new ValidationError('Ilova identifikatori shart.');

    // Avval ilovaning eski tokenini keshni tozalash uchun aniqlab olamiz
    const oldApp = await App.findOne({ _id: appId, developerId }).select('appToken').lean();
    if (!oldApp) {
      throw new AppError('Ilova topilmadi yoki kalitlarni yangilash huquqi sizda yo\'q.', 403);
    }

    // 🔐 HIGH-ENTROPY CRYPTOGRAPHY: Taxmin qilib bo'lmaydigan API kalitlari zanjiri
    const newAppToken = 'pk_' + crypto.randomBytes(16).toString('hex');  // Public Token
    const newAppSecret = 'sk_' + crypto.randomBytes(32).toString('hex'); // Secret Token

    // Kalitlarni bazada atomik tarzda yangilash
    const updatedApp = await App.findOneAndUpdate(
      { _id: appId, developerId },
      { 
        $set: { 
          appToken: newAppToken, 
          appSecret: newAppSecret 
        } 
      },
      { new: true, runValidators: true }
    ).select('name appToken +appSecret').lean();

    // ⚡ INSTANT CACHE FLUSH (Kritik Xavfsizlik Qatlami):
    // Bridge API va verifyAppSignature middleware'lari eski kalit bilan kelgan so'rovlarni 
    // darhol rad etishi uchun eski kesh kalitlarini zanjirband holda o'chiramiz.
    const oldSecurityKey = `app:data:${oldApp.appToken}`;
    const oldSecretKey = `app_secret:${oldApp.appToken}`;
    const storefrontKey = `app:details:${updatedApp.username?.toLowerCase()}`;

    await Promise.all([
      redis.del(oldSecurityKey),
      redis.del(oldSecretKey),
      redis.del(storefrontKey)
    ]);

    // Yangi kalitlarni Bridge xavfsizlik xizmati uchun 1 soatga zaxira keshga yozamiz
    await redis.set(`app:data:${newAppToken}`, JSON.stringify(updatedApp), 'EX', 3600);

    res.status(200).json({
      status: 'success',
      message: 'API kalitlari muvaffaqiyatli yangilandi va barcha eski sessiyalar bloklandi.',
      data: {
        appToken: updatedApp.appToken,
        appSecret: updatedApp.appSecret
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getApiKeys,
  regenerateApiKeys
};