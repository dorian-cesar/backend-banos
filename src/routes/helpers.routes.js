const express = require('express');
const router = express.Router();
const helpersController = require('../controllers/helpers.controller');

router.get('/metadata', helpersController.getMetadata);
router.get('/resumen', helpersController.getResumenMetadata);
router.get('/resumen-cajas', helpersController.getResumenPorCaja);

module.exports = router;
