const pool = require('../../config/db.config');

exports.listarMovimientosPorCaja = async (req, res) => {
    const numero_caja = req.query.numero_caja;

    if (!numero_caja || isNaN(numero_caja)) {
        return res.status(400).json({ success: false, error: 'Número de caja inválido.' });
    }

    try {
        // Verificar si hay una caja abierta para ese número
        const [cajaAbierta] = await pool.execute(
            `SELECT id 
         FROM aperturas_cierres 
         WHERE numero_caja = ? AND estado = 'abierta' 
         ORDER BY id DESC LIMIT 1`,
            [numero_caja]
        );

        if (cajaAbierta.length === 0) {
            return res.json({ success: false, mensaje: 'No hay caja abierta para este número.' });
        }

        const id_aperturas_cierres = cajaAbierta[0].id;

        // Obtener movimientos asociados a la sesión abierta
        const [movimientos] = await pool.execute(
            `SELECT 
           m.id,
           m.codigo,
           m.fecha,
           m.hora,
           m.monto,
           m.medio_pago,
           s.nombre AS nombre_servicio,
           s.tipo AS tipo_servicio,
           u.username AS nombre_usuario
         FROM movimientos m
         INNER JOIN servicios s ON s.id = m.id_servicio
         INNER JOIN users u ON u.id = m.id_usuario
         WHERE m.id_aperturas_cierres = ?
         ORDER BY m.fecha DESC, m.hora DESC`,
            [id_aperturas_cierres]
        );

        res.json({ success: true, movimientos });
    } catch (err) {
        console.error('Error al listar movimientos por caja:', err);
        res.status(500).json({ success: false, error: 'Error interno al listar movimientos.' });
    }
};

/*
exports.registrarMovimiento = async (req, res) => {
    try {
        const { numero_caja, codigo, fecha, hora, tipo, valor, metodoPago, id_usuario } = req.body;

        if (!numero_caja){
            return res.status(400).json({ success: false, message: 'No se encuentra el numero de caja' });
        }

        // Validaciones básicas
        if (!codigo || !fecha || !hora || !tipo || !valor || !metodoPago || !id_usuario) {
            return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });
        }

        if (isNaN(valor) || valor <= 0) {
            return res.status(400).json({ success: false, message: 'Valor debe ser un número mayor a 0' });
        }

        if (isNaN(id_usuario)) {
            return res.status(400).json({ success: false, message: 'ID de usuario inválido' });
        }

        // Obtener ID del servicio a partir del tipo (BAÑO o DUCHA)
        const [servicioData] = await pool.execute(
            'SELECT id FROM servicios WHERE tipo = ? AND estado = "activo" LIMIT 1',
            [tipo]
        );

        if (servicioData.length === 0) {
            return res.status(400).json({ success: false, message: 'Tipo de servicio no válido o inactivo' });
        }

        const id_servicio = servicioData[0].id;

        // Obtener ID de la sesión de caja abierta
        const [apertura] = await pool.execute(
            'SELECT id FROM aperturas_cierres WHERE numero_caja = ? AND estado = "abierta" ORDER BY id DESC LIMIT 1',
            [numero_caja]
        );

        if (apertura.length === 0) {
            return res.status(400).json({ success: false, message: 'No hay caja abierta' });
        }

        const id_aperturas_cierres = apertura[0].id;

        // Insertar movimiento
        const [result] = await pool.execute(
            `INSERT INTO movimientos 
         (codigo, fecha, hora, id_servicio, monto, medio_pago, numero_caja, id_usuario, id_aperturas_cierres)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [codigo, fecha, hora, id_servicio, valor, metodoPago, numero_caja, id_usuario, id_aperturas_cierres]
        );

        res.json({ success: true, message: 'Movimiento registrado', insertId: result.insertId });

    } catch (error) {
        console.error('Error al registrar movimiento:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
};

*/