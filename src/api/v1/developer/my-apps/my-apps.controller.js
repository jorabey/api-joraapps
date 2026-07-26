const App = require('../../../../models/App');
const redis = require('../../../../config/redis');
const crypto = require('crypto');
const { paginate } = require('../../../../utils/pagination');
const { ValidationError, AppError } = require('../../../../utils/appErrors');

// --- 🔐 AES-256 HIGH-SECURITY ENCRYPTION SETUP ---
const ALGORITHM = 'aes-256-cbc';

// Env kalitini har doim aniq 32 bayt (256-bit) bo'lishini ta'minlash
const getEncryptionKey = () => {
  const secret = process.env.MASTER_ENCRYPTION_KEY || 'jora_apps_default_secure_key_32_bytes';
  return crypto.createHash('sha256').update(String(secret)).digest();
};

// Kalitni shifrlash funksiyasi
const encryptSecret = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`; // IV va Shifrlangan matnni birga saqlaymiz
};

/**
 * 1. YANGI ILOVA QO'SHISH (Create App)
 * @desc Kriptografik xavfsiz AppToken yaratish va AppSecret'ni shifrlab saqlash
 */
const createApp = async (req, res, next) => {
  try {
    const { name, username, description, appUrl, iconUrl } = req.body;
    const developerId = req.developer._id;

    // 1. Kriptografik tasodifiy ochiq va maxfiy kalitlarni yaratish
    const rawAppSecret = 'sk_' + crypto.randomBytes(32).toString('hex');
    const appToken = 'pk_' + crypto.randomBytes(16).toString('hex');

    // 2. Maxfiy kalitni AES-256 bilan shifrlash (Plain-text bazaga tushmaydi!)
    const aesEncryptedSecret = encryptSecret(rawAppSecret);

    const appData = {
      developerId,
      name: name.trim(),
      username: username.toLowerCase().trim(),
      description: description ? description.trim() : '',
      appUrl: appUrl ? appUrl.trim() : '',
      iconUrl: iconUrl ? iconUrl.trim() : '',
      status: 'under_review',
      appToken: appToken,
      appSecret: aesEncryptedSecret // 🔐 Shifrlangan holda saqlanadi
    };

    const isExist = await App.findOne({ username: appData.username }).select('_id').lean();
    if (isExist) {
      throw new ValidationError('Ushbu ilova username\'i allaqachon band qilingan.');
    }

    const app = await App.create(appData);

    // 3. XAVFSIZLIK: Dasturchi rawSecret'ni FAQAT shu yerda bir marta ko'ra oladi
    res.status(201).json({
      status: 'success',
      message: 'Ilova muvaffaqiyatli yaratildi va moderatorlar tekshiruviga yuborildi.',
      data: {
        app: {
          _id: app._id,
          developerId: app.developerId,
          username: app.username,
          name: app.name,
          description: app.description,
          appUrl: app.appUrl,
          iconUrl: app.iconUrl,
          appToken: app.appToken,
          status: app.status,
          createdAt: app.createdAt
        },
        rawSecret: rawAppSecret // Buni darhol nusxalab olishi shart!
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. DASTURCHINING BARCHA ILOVALARINI OLISH (Get My Apps)
 */
const getMyApps = async (req, res, next) => {
  try {
    const developerId = req.developer._id;
    const { page = 1, limit = 20 } = req.query;

    const query = { developerId };
    const options = {
      page,
      limit,
      sort: { createdAt: -1 },
      select: 'name username description iconUrl status stats rating createdAt'
    };

    const result = await paginate(App, query, options);

    res.status(200).json({
      status: 'success',
      ...result
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. ILOVA METAMA'LUMOTLARINI YANGILASH (Update App)
 */
const updateApp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, appUrl, iconUrl } = req.body;
    const developerId = req.developer._id;

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (description) updateData.description = description.trim();
    if (appUrl) updateData.appUrl = appUrl.trim();
    if (iconUrl) updateData.iconUrl = iconUrl.trim();

    const app = await App.findOneAndUpdate(
      { _id: id, developerId },
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();

    if (!app) {
      throw new AppError('Ilova topilmadi yoki sizda uni o\'zgartirish huquqi yo\'q.', 403);
    }

    const storefrontKey = `app:details:${app.username.toLowerCase()}`;
    const securityKey = `app:data:${app.appToken}`;
    const listPattern = 'apps:list:page:*';

    await Promise.all([
      redis.del(storefrontKey),
      redis.del(securityKey),
      redis.del(listPattern)
    ]);

    res.status(200).json({
      status: 'success',
      message: 'Ilova ma\'lumotlari muvaffaqiyatli yangilandi va kesh yangilandi.',
      data: { app }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. ILOVANI GLOBAL O'CHIRISH (Delete App)
 */
const deleteApp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const developerId = req.developer._id;

    const app = await App.findOneAndDelete({ _id: id, developerId }).lean();
    if (!app) {
      throw new AppError('Ilova topilmadi yoki o\'chirish huquqiga ega emassiz.', 403);
    }

    await Promise.all([
      redis.del(`app:details:${app.username.toLowerCase()}`),
      redis.del(`app:data:${app.appToken}`),
      redis.del(`app_secret:${app.appToken}`)
    ]);

    res.status(200).json({
      status: 'success',
      message: 'Ilova platformadan va kesh xotiradan butunlay o\'chirildi.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createApp,
  getMyApps,
  updateApp,
  deleteApp
};