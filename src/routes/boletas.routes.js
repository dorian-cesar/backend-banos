const express = require("express");
const router = express.Router();
const boletasController = require("../controllers/boletas.controller");

router.get("/folios-restantes", boletasController.obtenerFoliosRestantes);
router.get("/info-caf", boletasController.obtenerInfoCAF);
router.post("/enviar", boletasController.emitirBoleta);
router.post("/enviar-lote", boletasController.emitirLoteBoletas);
router.post("/solicitar-folios", boletasController.solicitarNuevosFolios);

module.exports = router;
