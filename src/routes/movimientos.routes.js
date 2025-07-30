const express = require('express');
const router = express.Router();
const movimientosController = require('../controllers/movimientos.controller');

router.get('/', movimientosController.getAllMovimientos);
router.get('/:id', movimientosController.getMovimientoById);
router.post('/', movimientosController.createMovimiento);
router.put('/:id', movimientosController.updateMovimiento);
router.delete('/:id', movimientosController.deleteMovimiento);

module.exports = router;
