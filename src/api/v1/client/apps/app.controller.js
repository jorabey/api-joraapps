const App = require('../../../../models/App');
const redis = require('../../../../config/redis');
const { paginate } = require('../../../../utils/pagination');
const { ValidationError, AppError } = require('../../../../utils/appErrors');

/**
 * 1. ILOVALAR RO'YXATINI SORT VA PAGINATION BILAN OLISH (Get Apps / Charts)
 * @desc MAU, Rating va Newest bo'yicha saralash mexanizmi
 */
const getApps = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, sortBy = 'mau' } = req.query;

    // XAVFSIZLIK: Saralash maydonlarini qat'iy cheklash (NoSQL Injection oldini olish)
    const allowedSortFields = {
      mau: { 'stats.mau': -1, _id: -1 },
      rating: { 'rating.average': -1, 'rating.count': -1 },
      newest: { createdAt: -1 }
    };

    const sortOrder = allowedSortFields[sortBy] || allowedSortFields['mau'];

    // FAOL KESH TIZIMI: 1-sahifa kabi eng ko'p so'raladigan ma'lumotlarni Redisdan berish
    const cacheKey = `apps:list:page:${page}:limit:${limit}:sort:${sortBy}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        status: 'success',
        source: 'cache',
        ...JSON.parse(cachedData)
      });
    }

    // 🚀 ULTRA-TEZ QIDIRUV (Faqat 'live' statusdagi va platforma tasdiqlagan ilovalar)
    const query = { status: 'live' };
    const options = {
      page,
      limit,
      sort: sortOrder,
      select: 'name username description iconUrl rating stats isVerified' // Faqat kerakli maydonlar
    };

    const result = await paginate(App, query, options);

    // Keshga 2 daqiqaga yozib qo'yamiz (Trendlar tez o'zgarishi uchun qisqa muddat)
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 120);

    res.status(200).json({
      status: 'success',
      source: 'database',
      ...result
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. ULTRA-TEZ FULL-TEXT SEARCH (Ilovalarni Qidirish)
 * @desc MongoDB Text Index yordamida millionlab ilovalar ichidan sekundiga qidirish
 */
const searchApps = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    if (!q || q.trim() === '') {
      throw new ValidationError('Qidiruv matni kiritilishi shart.');
    }

    // XAVFSIZLIK: Qidiruv matnidan maxsus belgilarni tozalash (Regex/NoSQL sanitization)
    const sanitizedQuery = q.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').trim();

    // Text Search so'rovi va Score (moslik darajasi) bo'yicha saralash
    const query = {
      status: 'live',
      $text: { $search: sanitizedQuery }
    };

    const options = {
      page,
      limit,
      sort: { score: { $meta: 'textScore' } }, // Eng mos keladigan ilova tepada chiqadi
      select: 'name username description iconUrl rating stats isVerified'
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
 * 3. BUB-MILLISEKUNDLIK ILOVA TAFSILOTLARINI OLISH (Get Single App)
 * @desc Ilova username'i bo'yicha ma'lumotlarni o'ta yuqori tezlikda keshdan yoki DB dan yuklash
 */
const getAppDetails = async (req, res, next) => {
  try {
    const { username } = req.params;
    if (!username) throw new ValidationError('Ilova username\'i shart.');

    const cacheKey = `app:details:${username.toLowerCase()}`;
    
    // 1-Mudofaa: Keshni tekshirish
    const cachedApp = await redis.get(cacheKey);
    if (cachedApp) {
      return res.status(200).json({
        status: 'success',
        source: 'cache',
        data: { app: JSON.parse(cachedApp) }
      });
    }

    // 2-Mudofaa: Bazadan qidirish (.lean() xotirani 80% tejaydi)
    // XAVFSIZLIK: select('-appSecret') orqali maxfiy kalitni aslo tashqariga chiqarmaymiz!
    const app = await App.findOne({ username: username.toLowerCase(), status: 'live' })
      .select('-appSecret')
      .lean();

    if (!app) {
      throw new AppError('Ilova topilmadi yoki faol emas.', 404, 'APP_NOT_FOUND');
    }

    // Keyingi so'rovlar bazaga tushmasligi uchun 10 daqiqaga keshlaymiz
    await redis.set(cacheKey, JSON.stringify(app), 'EX', 600);

    res.status(200).json({
      status: 'success',
      source: 'database',
      data: { app }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getApps,
  searchApps,
  getAppDetails
};