const express = require("express");
const router = express.Router();

const authenticateToken = require("../middlewares/auth.middleware");

const usersRoutes = require("./users.routes");
const serviciosRoutes = require("./servicios.routes");
const movimientosRoutes = require("./movimientos.routes");
const cajasRoutes = require("./cajas.routes");
const aperturasCierresRoutes = require("./aperturasCierres.routes");
const helpersRoutes = require("./helpers.routes");
const authRoutes = require("./auth.routes");
const boletasRoutes = require("./boletas.routes");
const boletasCalamaRoutes = require("./boletasCalama.routes");
//const helpersController = require('../controllers/mantenedor/helpers.controller')

//sin autenticacion
router.use("/auth", authRoutes);
//router.use('/resumenCajas', helpersController.getResumenPorCaja);

//autenticados
router.use("/users", authenticateToken, usersRoutes);
router.use("/services", authenticateToken, serviciosRoutes);
router.use("/movimientos", authenticateToken, movimientosRoutes);
router.use("/cajas", authenticateToken, cajasRoutes);
router.use("/aperturas-cierres", authenticateToken, aperturasCierresRoutes);
router.use("/helpers", authenticateToken, helpersRoutes);
router.use("/boletas", boletasRoutes);
router.use("/boletas-calama", boletasCalamaRoutes);

module.exports = router;
