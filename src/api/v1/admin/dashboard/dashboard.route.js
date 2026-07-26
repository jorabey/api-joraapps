const express = require('express');
const ctrl = require('./dashboard.controller');
const { requireAdminAuth } = require('../../../../middlewares/requireAdminAuth');
const { apiLimiterMiddleware } = require('../../../../middlewares/rateLimiter');

const router = express.Router();

router.use(apiLimiterMiddleware);
router.use(requireAdminAuth);

/**
 * @route   GET /api/v1/admin/dashboard/overview
 */
router.get('/overview', ctrl.getOverview);

/**
 * @route   GET /api/v1/admin/dashboard/activity
 */
router.get('/activity', ctrl.getRecentActivity);

/**
 * @route   GET /api/v1/admin/dashboard/growth
 */
router.get('/growth', ctrl.getGrowthTrend);

module.exports = router;
