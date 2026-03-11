'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const userController = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { validateObjectId } = require('../middlewares/not-found.middleware');
const { ROLES } = require('../models/user.model');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
});

router.use(authenticate);

// ─── Current User Routes ──────────────────────────────────────────────────────
router.get('/me', userController.getMe.bind(userController));
router.patch('/me', userController.updateMe.bind(userController));
router.delete('/me', userController.deleteMe.bind(userController));
router.get('/me/sessions', userController.getUserSessions.bind(userController));
router.patch('/me/preferences', userController.updatePreferences.bind(userController));
router.post('/me/avatar', upload.single('avatar'), userController.uploadAvatar.bind(userController));

// ─── Admin User Management ────────────────────────────────────────────────────
router.get('/', authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), userController.getUsers.bind(userController));
router.get('/:id', authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), validateObjectId(), userController.getUserById.bind(userController));
router.patch('/:id', authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), validateObjectId(), userController.updateUser.bind(userController));
router.delete('/:id', authorize(ROLES.SUPER_ADMIN), validateObjectId(), userController.deleteUser.bind(userController));

module.exports = router;
