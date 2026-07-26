const express = require('express');
const ctrl = require('./admin.users.controller');
const validation = require('./admin.users.validation');
const { requireAdminAuth } = require('../../../../middlewares/requireAdminAuth');
const { apiLimiterMiddleware } = require('../../../../middlewares/rateLimiter');

const router = express.Router();

router.use(apiLimiterMiddleware);
router.use(requireAdminAuth);

/**
 * @route   GET /api/v1/admin/users
 */
router.get('/', validation.validateListQuery, ctrl.listUsers);

/**
 * @route   GET /api/v1/admin/users/:id
 */
router.get('/:id', validation.validateIdParam, ctrl.getUserDetail);

/**
 * @route   PATCH /api/v1/admin/users/:id/block
 */
router.patch('/:id/block', validation.validateIdParam, validation.validateBlock, ctrl.blockUser);

/**
 * @route   PATCH /api/v1/admin/users/:id/unblock
 */
router.patch('/:id/unblock', validation.validateIdParam, ctrl.unblockUser);

/**
 * @route   POST /api/v1/admin/users/:id/force-logout
 */
router.post('/:id/force-logout', validation.validateIdParam, ctrl.forceLogoutUser);

module.exports = router;
