const express = require('express');
const router = express.Router();
const cajasController = require('../controllers/mantenedor/cajas.controller');

router.get('/', cajasController.getAllCajas);
router.get('/:id', cajasController.getCajaById);
router.post('/', cajasController.createCaja);
router.put('/:id', cajasController.updateCaja);
router.delete('/:id', cajasController.deleteCaja);

module.exports = router;
