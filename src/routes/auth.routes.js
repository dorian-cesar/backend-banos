const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.post('/loginAdmin', authController.loginAdmin);
router.post('/loginUser', authController.loginUser);
router.post('/forgot', authController.forgot);
router.post('/reset', authController.reset);

module.exports = router;
