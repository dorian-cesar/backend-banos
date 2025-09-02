const express = require('express');
const router = express.Router();
const boletasController = require('../controllers/boletas.controller');

router.post('/enviar', boletasController.emitirBoleta);

module.exports = router;