const Developer = require('../../../../models/Developer');
const App = require('../../../../models/App');
const { paginate } = require('../../../../utils/pagination');
const { AppError } = require('../../../../utils/appErrors');
const { logAdminAction } = require('../../../../utils/auditLog');

/**
 * 1. BARCHA DASTURCHILAR RO'YXATI
 */
const listDevelopers = async (req, res, next) => {
  try {
    const { page, limit, status, q } = req.query;

    const query = {};
    if (status && status !== 'all') query.status = status;
    if (q) {
      query.$or = [
        { fullName: { $regex: q, $options: 'i' } },
        { companyName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ];
    }

    const result = await paginate(Developer, query, {
      page, limit,
      sort: { createdAt: -1 },
      select: 'fullName companyName email website status isVerified moderation lastLoginAt createdAt'
    });

    res.status(200).json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. BITTA DASTURCHI TO'LIQ MA'LUMOTI (ilovalari bilan)
 */
const getDeveloperDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const developer = await Developer.findById(id).lean();
    if (!developer) throw new AppError('Dasturchi topilmadi.', 404);

    const apps = await App.find({ developerId: id })
      .select('name username status iconUrl stats rating createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ status: 'success', data: { developer, apps } });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. DASTURCHINI TASDIQLASH (pending_review → active)
 */
const approveDeveloper = async (req, res, next) => {
  try {
    const { id } = req.params;

    const developer = await Developer.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'active',
          'moderation.reviewedBy': req.admin._id,
          'moderation.reviewedAt': new Date(),
          'moderation.suspendedReason': null
        }
      },
      { new: true }
    );
    if (!developer) throw new AppError('Dasturchi topilmadi.', 404);

    logAdminAction({
      admin: req.admin,
      action: 'developer.approve',
      targetType: 'Developer',
      targetId: developer._id,
      description: `Dasturchi tasdiqlandi: ${developer.email}`,
      ipAddress: req.ip
    });

    res.status(200).json({ status: 'success', message: 'Dasturchi tasdiqlandi.', data: { developer } });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. DASTURCHINI TO'XTATISH / BLOKLASH (active → suspended)
 * tokenVersion oshiriladi — barcha mavjud sessiyalar (access/refresh) darhol
 * yaroqsiz bo'ladi, hatto eski access token muddati tugamagan bo'lsa ham
 * keyingi requireDevAuth so'rovida status='active' tekshiruvidan o'tolmaydi.
 */
const suspendDeveloper = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const developer = await Developer.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'suspended',
          'moderation.suspendedReason': reason,
          'moderation.reviewedBy': req.admin._id,
          'moderation.reviewedAt': new Date()
        },
        $inc: { tokenVersion: 1 }
      },
      { new: true }
    );
    if (!developer) throw new AppError('Dasturchi topilmadi.', 404);

    logAdminAction({
      admin: req.admin,
      action: 'developer.suspend',
      targetType: 'Developer',
      targetId: developer._id,
      description: `Dasturchi to'xtatildi: ${developer.email} — ${reason}`,
      meta: { reason },
      ipAddress: req.ip
    });

    res.status(200).json({
      status: 'success',
      message: 'Dasturchi to\'xtatildi va barcha sessiyalari bekor qilindi.',
      data: { developer }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 5. DASTURCHINI QAYTA FAOLLASHTIRISH (suspended → active)
 */
const reactivateDeveloper = async (req, res, next) => {
  try {
    const { id } = req.params;

    const developer = await Developer.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'active',
          'moderation.suspendedReason': null,
          'moderation.reviewedBy': req.admin._id,
          'moderation.reviewedAt': new Date()
        }
      },
      { new: true }
    );
    if (!developer) throw new AppError('Dasturchi topilmadi.', 404);

    logAdminAction({
      admin: req.admin,
      action: 'developer.reactivate',
      targetType: 'Developer',
      targetId: developer._id,
      description: `Dasturchi qayta faollashtirildi: ${developer.email}`,
      ipAddress: req.ip
    });

    res.status(200).json({ status: 'success', message: 'Dasturchi qayta faollashtirildi.', data: { developer } });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listDevelopers,
  getDeveloperDetail,
  approveDeveloper,
  suspendDeveloper,
  reactivateDeveloper
};
