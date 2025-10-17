const express = require("express");
const router = express.Router();
const boletasController = require("../controllers/boletasCalama.controller");

router.get("/folios-restantes", boletasController.obtenerFoliosRestantes);
router.get("/info-caf", boletasController.obtenerInfoCAF);
router.get("/status", boletasController.obtenerStatusSuscripcion);
router.post("/enviar", boletasController.emitirBoleta);
router.post("/enviar-lote", boletasController.emitirLoteBoletas);
router.post("/solicitar-folios", boletasController.solicitarNuevosFolios);
// router.delete("/borrar-boletas", boletasController.borrarTodasLasBoletas);

module.exports = router;
