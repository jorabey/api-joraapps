const AppReport = require('../../../../models/AppReport');
const { paginate } = require('../../../../utils/pagination');
const { AppError } = require('../../../../utils/appErrors');
const { logAdminAction } = require('../../../../utils/auditLog');

/**
 * 1. BARCHA SHIKOYATLAR RO'YXATI
 */
const listReports = async (req, res, next) => {
  try {
    const { page, limit, status, reason, appId } = req.query;

    const query = {};
    if (status && status !== 'all') query.status = status;
    if (reason && reason !== 'all') query.reason = reason;
    if (appId) query.appId = appId;

    const result = await paginate(AppReport, query, {
      page, limit,
      sort: { createdAt: -1 }
    });

    // populate paginate utilida yo'q — qo'lda to'ldiramiz (faqat shu sahifadagi hujjatlar uchun)
    await AppReport.populate(result.data, [
      { path: 'appId', select: 'name username iconUrl status' },
      { path: 'reporterId', select: 'username firstName lastName email' }
    ]);

    res.status(200).json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. BITTA SHIKOYAT TO'LIQ MA'LUMOTI + shu ilovaga oid boshqa shikoyatlar
 */
const getReportDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const report = await AppReport.findById(id)
      .populate('appId', 'name username iconUrl status category')
      .populate('reporterId', 'username firstName lastName email')
      .lean();
    if (!report) throw new AppError('Shikoyat topilmadi.', 404);

    const relatedReports = await AppReport.find({ appId: report.appId._id, _id: { $ne: id } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('reason status createdAt')
      .lean();

    res.status(200).json({ status: 'success', data: { report, relatedReports } });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. SHIKOYATNI "TEKSHIRILMOQDA" HOLATIGA O'TKAZISH
 */
const investigateReport = async (req, res, next) => {
  try {
    const { id } = req.params;

    const report = await AppReport.findByIdAndUpdate(
      id,
      { $set: { status: 'investigating' } },
      { new: true }
    );
    if (!report) throw new AppError('Shikoyat topilmadi.', 404);

    logAdminAction({
      admin: req.admin,
      action: 'report.investigate',
      targetType: 'AppReport',
      targetId: report._id,
      description: 'Shikoyat tekshiruvga olindi.',
      ipAddress: req.ip
    });

    res.status(200).json({ status: 'success', message: 'Shikoyat tekshiruvga olindi.', data: { report } });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. SHIKOYATNI HAL QILISH (resolved)
 */
const resolveReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adminComment } = req.body;

    const report = await AppReport.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'resolved',
          adminComment: adminComment || null,
          resolvedAt: new Date()
        }
      },
      { new: true }
    );
    if (!report) throw new AppError('Shikoyat topilmadi.', 404);

    logAdminAction({
      admin: req.admin,
      action: 'report.resolve',
      targetType: 'AppReport',
      targetId: report._id,
      description: `Shikoyat hal qilindi. ${adminComment ? '— ' + adminComment : ''}`,
      ipAddress: req.ip
    });

    res.status(200).json({ status: 'success', message: 'Shikoyat hal qilindi.', data: { report } });
  } catch (err) {
    next(err);
  }
};

/**
 * 5. SHIKOYATNI RAD ETISH (asossiz deb topish)
 */
const rejectReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adminComment } = req.body;

    const report = await AppReport.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'rejected',
          adminComment,
          resolvedAt: new Date()
        }
      },
      { new: true }
    );
    if (!report) throw new AppError('Shikoyat topilmadi.', 404);

    logAdminAction({
      admin: req.admin,
      action: 'report.reject',
      targetType: 'AppReport',
      targetId: report._id,
      description: `Shikoyat asossiz deb rad etildi: ${adminComment}`,
      ipAddress: req.ip
    });

    res.status(200).json({ status: 'success', message: 'Shikoyat rad etildi.', data: { report } });
  } catch (err) {
    next(err);
  }
};

/**
 * 6. STATUSNI QO'LDA O'ZGARTIRISH (moslashuvchan — istalgan holatga o'tkazish)
 */
const setReportStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminComment } = req.body;

    const updateData = { status };
    if (adminComment !== undefined) updateData.adminComment = adminComment || null;
    if (status === 'resolved' || status === 'rejected') updateData.resolvedAt = new Date();

    const report = await AppReport.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    if (!report) throw new AppError('Shikoyat topilmadi.', 404);

    logAdminAction({
      admin: req.admin,
      action: 'report.set_status',
      targetType: 'AppReport',
      targetId: report._id,
      description: `Shikoyat statusi: ${status}`,
      ipAddress: req.ip
    });

    res.status(200).json({ status: 'success', message: 'Shikoyat statusi yangilandi.', data: { report } });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listReports,
  getReportDetail,
  investigateReport,
  resolveReport,
  rejectReport,
  setReportStatus
};
