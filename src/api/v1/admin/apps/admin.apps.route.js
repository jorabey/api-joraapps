const express = require('express');
const ctrl = require('./admin.apps.controller');
const validation = require('./admin.apps.validation');
const { requireAdminAuth, requireRole } = require('../../../../middlewares/requireAdminAuth');
const { apiLimiterMiddleware } = require('../../../../middlewares/rateLimiter');

const router = express.Router();

router.use(apiLimiterMiddleware);
router.use(requireAdminAuth);

/**
 * @route   GET /api/v1/admin/apps
 * @desc    Barcha ilovalar — status/category/qidiruv filtri bilan
 */
router.get('/', validation.validateListQuery, ctrl.listApps);

/**
 * @route   GET /api/v1/admin/apps/:id
 */
router.get('/:id', validation.validateAppIdParam, ctrl.getAppDetail);

/**
 * @route   PATCH /api/v1/admin/apps/:id/approve
 * @desc    under_review → live (tekshiruvdan o'tkazib tasdiqlash)
 */
router.patch('/:id/approve', validation.validateAppIdParam, validation.validateApprove, ctrl.approveApp);

/**
 * @route   PATCH /api/v1/admin/apps/:id/reject
 * @desc    under_review → suspended (sabab bilan rad etish)
 */
router.patch('/:id/reject', validation.validateAppIdParam, validation.validateReject, ctrl.rejectApp);

/**
 * @route   PATCH /api/v1/admin/apps/:id/suspend
 * @desc    live → suspended (Bridge API darhol yopiladi)
 */
router.patch('/:id/suspend', validation.validateAppIdParam, validation.validateSuspend, ctrl.suspendApp);

/**
 * @route   PATCH /api/v1/admin/apps/:id/restore
 * @desc    suspended → live
 */
router.patch('/:id/restore', validation.validateAppIdParam, ctrl.restoreApp);

/**
 * @route   PATCH /api/v1/admin/apps/:id/category
 */
router.patch('/:id/category', validation.validateAppIdParam, validation.validateCategory, ctrl.setCategory);

/**
 * @route   PATCH /api/v1/admin/apps/:id/verify
 */
router.patch('/:id/verify', validation.validateAppIdParam, validation.validateVerify, ctrl.setVerified);

/**
 * @route   DELETE /api/v1/admin/apps/:id
 * @access  super_admin, moderator (support ruxsat etilmagan — qaytarib bo'lmas amal)
 */
router.delete('/:id', requireRole('super_admin', 'moderator'), validation.validateAppIdParam, ctrl.deleteApp);

module.exports = router;
