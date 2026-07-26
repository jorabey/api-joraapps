const express = require('express');
const ctrl = require('./admin.audit-logs.controller');
const { requireAdminAuth } = require('../../../../middlewares/requireAdminAuth');
const { apiLimiterMiddleware } = require('../../../../middlewares/rateLimiter');

const router = express.Router();

router.use(apiLimiterMiddleware);
router.use(requireAdminAuth);

/**
 * @route   GET /api/v1/admin/audit-logs
 */
router.get('/', ctrl.listLogs);

/**
 * @route   GET /api/v1/admin/audit-logs/:targetType/:targetId
 */
router.get('/:targetType/:targetId', ctrl.getTargetHistory);

module.exports = router;
