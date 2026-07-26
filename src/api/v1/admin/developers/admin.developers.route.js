const express = require('express');
const ctrl = require('./admin.developers.controller');
const validation = require('./admin.developers.validation');
const { requireAdminAuth } = require('../../../../middlewares/requireAdminAuth');
const { apiLimiterMiddleware } = require('../../../../middlewares/rateLimiter');

const router = express.Router();

router.use(apiLimiterMiddleware);
router.use(requireAdminAuth);

/**
 * @route   GET /api/v1/admin/developers
 */
router.get('/', validation.validateListQuery, ctrl.listDevelopers);

/**
 * @route   GET /api/v1/admin/developers/:id
 */
router.get('/:id', validation.validateIdParam, ctrl.getDeveloperDetail);

/**
 * @route   PATCH /api/v1/admin/developers/:id/approve
 * @desc    pending_review → active
 */
router.patch('/:id/approve', validation.validateIdParam, ctrl.approveDeveloper);

/**
 * @route   PATCH /api/v1/admin/developers/:id/suspend
 */
router.patch('/:id/suspend', validation.validateIdParam, validation.validateSuspend, ctrl.suspendDeveloper);

/**
 * @route   PATCH /api/v1/admin/developers/:id/reactivate
 */
router.patch('/:id/reactivate', validation.validateIdParam, ctrl.reactivateDeveloper);

module.exports = router;
