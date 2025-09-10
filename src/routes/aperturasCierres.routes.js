const express = require('express');
const router = express.Router();
const aperturasCierresMantenedor = require('../controllers/mantenedor/aperturasCierres.controller');
const aperturasCierresCajas = require('../controllers/cajas/aperturasCierres.controller');

//GET
router.get('/', aperturasCierresMantenedor.getAllAperturasCierres);
router.get('/:id', aperturasCierresMantenedor.getAperturaCierreById);

//POST
//mantenedor
router.post('/', aperturasCierresMantenedor.createAperturaCierre);

//cajas
router.post('/abrir', aperturasCierresCajas.abrirCaja);
router.post('/cerrar', aperturasCierresCajas.cerrarCaja);
router.post('/retiro', aperturasCierresCajas.registrarRetiro)

//PUT
router.put('/:id', aperturasCierresMantenedor.updateAperturaCierre);

//DELETE
router.delete('/:id', aperturasCierresMantenedor.deleteAperturaCierre);

module.exports = router;
