/**
 * Pagination Utility (Professional Grade)
 * @param {Model} model - Mongoose model
 * @param {Object} query - MongoDB query object
 * @param {Object} options - { page, limit, sort, select }
 */
const paginate = async (model, query = {}, options = {}) => {
  // 1. XAVFSIZLIK: Input validatsiyasi va Default qiymatlar
  const page = Math.max(1, parseInt(options.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 20)); // Max limit 100
  const skip = (page - 1) * limit;

  // 2. TEZLIK: Sorgularni parallel bajarish (Promise.all)
  // total count va ma'lumotlarni olishni bir vaqtda boshlaymiz
  const [data, total] = await Promise.all([
    model
      .find(query)
      .select(options.select || '')
      .sort(options.sort || { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(), // LEAN: Mongoose obyektlarini yaratmaydi, to'g'ridan-to'g'ri JSON qaytaradi (Tezlik!)
    model.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
};

/**
 * CURSOR-BASED PAGINATION (Milliardlab ma'lumotlar uchun eng tezkor yechim)
 * Skip/Limit ishlatmaydi, shuning uchun bazada yuklama nolga teng.
 */
const paginateCursor = async (model, query = {}, limit = 20, lastId = null) => {
  const findQuery = { ...query };
  
  // Oxirgi olingan ID dan keyingisini olish (Keyingisi > lastId)
  if (lastId) {
    findQuery._id = { $gt: lastId };
  }

  const data = await model
    .find(findQuery)
    .sort({ _id: 1 })
    .limit(limit + 1) // +1 keyingi sahifa borligini bilish uchun
    .lean();

  const hasNextPage = data.length > limit;
  const items = hasNextPage ? data.slice(0, limit) : data;
  const nextCursor = hasNextPage ? items[items.length - 1]._id : null;

  return {
    items,
    nextCursor,
    hasNextPage
  };
};

module.exports = { paginate, paginateCursor };