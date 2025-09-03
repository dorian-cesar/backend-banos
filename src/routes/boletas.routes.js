const express = require('express');
const router = express.Router();
const boletasController = require('../controllers/boletas.controller');

router.post('/enviar', boletasController.emitirBoleta);
router.post('/solicitar-folios', boletasController.solicitarNuevosFolios);

module.exports = router;