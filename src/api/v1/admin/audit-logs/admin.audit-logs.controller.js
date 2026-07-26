const AuditLog = require('../../../../models/AuditLog');
const { paginate } = require('../../../../utils/pagination');

/**
 * 1. BARCHA AUDIT YOZUVLARI — filtrlash bilan
 */
const listLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, action, targetType, adminId } = req.query;

    const query = {};
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;
    if (adminId) query.adminId = adminId;

    const result = await paginate(AuditLog, query, {
      page, limit,
      sort: { createdAt: -1 }
    });

    res.status(200).json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. BITTA OBYEKT TARIXI (masalan, bitta ilova ustida qilingan barcha amallar)
 */
const getTargetHistory = async (req, res, next) => {
  try {
    const { targetType, targetId } = req.params;

    const logs = await AuditLog.find({ targetType, targetId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.status(200).json({ status: 'success', data: { logs } });
  } catch (err) {
    next(err);
  }
};

module.exports = { listLogs, getTargetHistory };
