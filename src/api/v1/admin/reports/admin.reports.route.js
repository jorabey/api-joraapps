const express = require('express');
const ctrl = require('./admin.reports.controller');
const validation = require('./admin.reports.validation');
const { requireAdminAuth } = require('../../../../middlewares/requireAdminAuth');
const { apiLimiterMiddleware } = require('../../../../middlewares/rateLimiter');

const router = express.Router();

router.use(apiLimiterMiddleware);
router.use(requireAdminAuth);

/**
 * @route   GET /api/v1/admin/reports
 */
router.get('/', validation.validateListQuery, ctrl.listReports);

/**
 * @route   GET /api/v1/admin/reports/:id
 */
router.get('/:id', validation.validateIdParam, ctrl.getReportDetail);

/**
 * @route   PATCH /api/v1/admin/reports/:id/investigate
 */
router.patch('/:id/investigate', validation.validateIdParam, ctrl.investigateReport);

/**
 * @route   PATCH /api/v1/admin/reports/:id/resolve
 */
router.patch('/:id/resolve', validation.validateIdParam, validation.validateResolve, ctrl.resolveReport);

/**
 * @route   PATCH /api/v1/admin/reports/:id/reject
 */
router.patch('/:id/reject', validation.validateIdParam, validation.validateReject, ctrl.rejectReport);

/**
 * @route   PATCH /api/v1/admin/reports/:id/status
 * @desc    Moslashuvchan status o'zgartirish (istalgan holatga)
 */
router.patch('/:id/status', validation.validateIdParam, validation.validateSetStatus, ctrl.setReportStatus);

module.exports = router;
