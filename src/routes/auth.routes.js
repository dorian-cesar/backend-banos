const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.post('/login', authController.login);
router.post('/forgot', authController.forgot);
router.post('/reset', authController.reset);

module.exports = router;
