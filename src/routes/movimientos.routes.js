const express = require('express');
const router = express.Router();
const movimientosMantenedor = require('../controllers/mantenedor/movimientos.controller');
const movimientosCaja = require('../controllers/cajas/movimientos.controller');

//GET
//cajas
router.get('/por-caja', movimientosCaja.listarMovimientosPorCaja)
//mantenedor
router.get('/', movimientosMantenedor.getAllMovimientos);
router.get('/:id', movimientosMantenedor.getMovimientoById);

//POST
router.post('/', movimientosMantenedor.createMovimiento);

//PUT
router.put('/:id', movimientosMantenedor.updateMovimiento);

//DELETE
router.delete('/:id', movimientosMantenedor.deleteMovimiento);



module.exports = router;
