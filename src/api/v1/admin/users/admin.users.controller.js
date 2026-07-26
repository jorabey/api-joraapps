const User = require('../../../../models/User');
const Session = require('../../../../models/Session');
const UserAppConnection = require('../../../../models/UserAppConnection');
const AppReport = require('../../../../models/AppReport');
const { paginate } = require('../../../../utils/pagination');
const { AppError } = require('../../../../utils/appErrors');
const { logAdminAction } = require('../../../../utils/auditLog');

/**
 * 1. BARCHA FOYDALANUVCHILAR RO'YXATI
 */
const listUsers = async (req, res, next) => {
  try {
    const { page, limit, blocked, q } = req.query;

    const query = {};
    if (blocked === 'true') query.isBlocked = true;
    if (blocked === 'false') query.isBlocked = false;
    if (q) {
      query.$or = [
        { username: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } }
      ];
    }

    const result = await paginate(User, query, {
      page, limit,
      sort: { createdAt: -1 },
      select: 'username email phone firstName lastName isBlocked accountStatus moderation lastOnline createdAt'
    });

    res.status(200).json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. BITTA FOYDALANUVCHI TO'LIQ MA'LUMOTI
 */
const getUserDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).lean();
    if (!user) throw new AppError('Foydalanuvchi topilmadi.', 404);

    const [connectionsCount, reportsFiledCount, activeSessions] = await Promise.all([
      UserAppConnection.countDocuments({ userId: id, status: 'connected' }),
      AppReport.countDocuments({ reporterId: id }),
      Session.countDocuments({ userId: id, isRevoked: false, expiresAt: { $gt: new Date() } })
    ]);

    res.status(200).json({
      status: 'success',
      data: { user, connectionsCount, reportsFiledCount, activeSessions }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. FOYDALANUVCHINI BLOKLASH (+ barcha sessiyalarini majburiy tugatish)
 */
const blockUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          isBlocked: true,
          'moderation.blockedReason': reason,
          'moderation.blockedBy': req.admin._id,
          'moderation.blockedAt': new Date()
        }
      },
      { new: true }
    );
    if (!user) throw new AppError('Foydalanuvchi topilmadi.', 404);

    // Barcha faol sessiyalarni darhol bekor qilish — bloklangan user
    // requireAuth orqali kira olmaydi, lekin mavjud access tokenlari
    // 15 daqiqagacha amal qilishi mumkin edi; bu yerda refresh zanjiri
    // kesiladi va Session jadvali ham izchil holatda saqlanadi.
    await Session.updateMany({ userId: id, isRevoked: false }, { $set: { isRevoked: true } });

    logAdminAction({
      admin: req.admin,
      action: 'user.block',
      targetType: 'User',
      targetId: user._id,
      description: `Foydalanuvchi bloklandi: @${user.username} — ${reason}`,
      meta: { reason },
      ipAddress: req.ip
    });

    res.status(200).json({
      status: 'success',
      message: 'Foydalanuvchi bloklandi va barcha sessiyalari tugatildi.',
      data: { user }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. FOYDALANUVCHINI BLOKDAN CHIQARISH
 */
const unblockUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          isBlocked: false,
          'moderation.blockedReason': null,
          'moderation.blockedBy': req.admin._id,
          'moderation.blockedAt': null
        }
      },
      { new: true }
    );
    if (!user) throw new AppError('Foydalanuvchi topilmadi.', 404);

    logAdminAction({
      admin: req.admin,
      action: 'user.unblock',
      targetType: 'User',
      targetId: user._id,
      description: `Foydalanuvchi blokdan chiqarildi: @${user.username}`,
      ipAddress: req.ip
    });

    res.status(200).json({ status: 'success', message: 'Foydalanuvchi blokdan chiqarildi.', data: { user } });
  } catch (err) {
    next(err);
  }
};

/**
 * 5. FOYDALANUVCHINI BARCHA QURILMALARDAN MAJBURIY CHIQARISH
 * (bloklamasdan, faqat sessiyalarni tugatish — masalan, shubhali faollik
 * tergovi paytida akkauntni darhol "sovutish" uchun)
 */
const forceLogoutUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('username').lean();
    if (!user) throw new AppError('Foydalanuvchi topilmadi.', 404);

    const result = await Session.updateMany({ userId: id, isRevoked: false }, { $set: { isRevoked: true } });

    logAdminAction({
      admin: req.admin,
      action: 'user.force_logout',
      targetType: 'User',
      targetId: id,
      description: `@${user.username} barcha qurilmalardan majburiy chiqarildi (${result.modifiedCount} ta sessiya).`,
      meta: { revokedCount: result.modifiedCount },
      ipAddress: req.ip
    });

    res.status(200).json({
      status: 'success',
      message: `${result.modifiedCount} ta sessiya tugatildi.`
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listUsers,
  getUserDetail,
  blockUser,
  unblockUser,
  forceLogoutUser
};
