const express = require('express');
const ctrl = require('./admin.auth.controller');
const validation = require('./admin.auth.validation');
const { requireAdminAuth, requireRole } = require('../../../../middlewares/requireAdminAuth');
const { authLimiterMiddleware, apiLimiterMiddleware } = require('../../../../middlewares/rateLimiter');

const router = express.Router();

/**
 * @route   POST /api/v1/admin/auth/login
 * @access  Public (lekin hujjat oldindan bazada bo'lishi shart)
 */
router.post('/login', authLimiterMiddleware, validation.validateLogin, ctrl.login);

/**
 * @route   POST /api/v1/admin/auth/refresh
 */
router.post('/refresh', apiLimiterMiddleware, ctrl.refreshTokens);

/**
 * @route   POST /api/v1/admin/auth/logout
 */
router.post('/logout', apiLimiterMiddleware, ctrl.logout);

// --- Quyidagilar autentifikatsiya talab qiladi ---
router.use(apiLimiterMiddleware);
router.use(requireAdminAuth);

/**
 * @route   GET /api/v1/admin/auth/me
 */
router.get('/me', ctrl.getMe);

/**
 * @route   PUT /api/v1/admin/auth/password
 */
router.put('/password', validation.validateChangePassword, ctrl.changePassword);

/**
 * @route   GET /api/v1/admin/auth/admins
 * @access  super_admin only
 */
router.get('/admins', requireRole('super_admin'), ctrl.listAdmins);

/**
 * @route   POST /api/v1/admin/auth/admins
 * @access  super_admin only
 */
router.post('/admins', requireRole('super_admin'), validation.validateCreateAdmin, ctrl.createAdmin);

/**
 * @route   PATCH /api/v1/admin/auth/admins/:id/status
 * @access  super_admin only
 */
router.patch('/admins/:id/status', requireRole('super_admin'), ctrl.setAdminStatus);

module.exports = router;
