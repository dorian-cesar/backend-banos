const express = require('express');
const router = express.Router();
const aperturasCierresController = require('../controllers/aperturasCierres.controller');

router.get('/', aperturasCierresController.getAllAperturasCierres);
router.get('/:id', aperturasCierresController.getAperturaCierreById);
router.post('/', aperturasCierresController.createAperturaCierre);
router.put('/:id', aperturasCierresController.updateAperturaCierre);
router.delete('/:id', aperturasCierresController.deleteAperturaCierre);

module.exports = router;
