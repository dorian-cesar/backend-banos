const express = require('express')
const router = express.Router();

const usersRoutes = require('./users.routes')
const serviciosRoutes = require('./servicios.routes')
const movimientosRoutes = require('./movimientos.routes');
const cajasRoutes = require('./cajas.routes');
const aperturasCierresRoutes = require('./aperturasCierres.routes');
const authRoutes = require('./auth.routes');


router.use('/users', usersRoutes);
router.use('/services', serviciosRoutes);
router.use('/movimientos', movimientosRoutes);
router.use('/cajas', cajasRoutes);
router.use('/aperturas-cierres', aperturasCierresRoutes);
router.use('/auth', authRoutes);

module.exports = router;