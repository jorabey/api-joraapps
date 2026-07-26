const express = require('express');
const ctrl = require('./admin.bridge.controller');
const validation = require('./admin.bridge.validation');
const { requireAdminAuth } = require('../../../../middlewares/requireAdminAuth');
const { apiLimiterMiddleware } = require('../../../../middlewares/rateLimiter');

const router = express.Router();

router.use(apiLimiterMiddleware);
router.use(requireAdminAuth);

/**
 * @route   GET /api/v1/admin/bridge/overview
 * @desc    Barcha live/suspended ilovalarning Bridge faolligi (DAU, MAU)
 */
router.get('/overview', ctrl.getBridgeOverview);

/**
 * @route   GET /api/v1/admin/bridge/:id
 */
router.get('/:id', validation.validateIdParam, ctrl.getAppBridgeStatus);

/**
 * @route   PATCH /api/v1/admin/bridge/:id/close
 * @desc    Bridge API kirishini darhol yopadi (= app.status = 'suspended')
 */
router.patch('/:id/close', validation.validateIdParam, validation.validateClose, ctrl.closeBridge);

/**
 * @route   PATCH /api/v1/admin/bridge/:id/reopen
 */
router.patch('/:id/reopen', validation.validateIdParam, ctrl.reopenBridge);

/**
 * @route   POST /api/v1/admin/bridge/:id/flush-cache
 */
router.post('/:id/flush-cache', validation.validateIdParam, ctrl.flushPermissionCache);

module.exports = router;
