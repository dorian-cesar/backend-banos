const db = require('../config/db.config');

// Obtener todos los movimientos
exports.getAllMovimientos = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM movimientos');
        const [results] = await db.query(
            'SELECT * FROM movimientos ORDER BY id DESC LIMIT ? OFFSET ?',
            [pageSize, offset]
        );

        res.json({ total, page, pageSize, data: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// Obtener un movimiento por ID
exports.getMovimientoById = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM movimientos WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Movimiento no encontrado' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Crear nuevo movimiento
exports.createMovimiento = async (req, res) => {
    const {
        id_aperturas_cierres,
        id_usuario,
        id_servicio,
        numero_caja,
        monto,
        medio_pago,
        fecha,
        hora,
        codigo,
    } = req.body;

    if (
        !id_aperturas_cierres ||
        !id_usuario ||
        !id_servicio ||
        !numero_caja ||
        !monto ||
        !medio_pago ||
        !fecha ||
        !hora
    ) {
        return res
            .status(400)
            .json({ error: 'Todos los campos obligatorios deben estar presentes' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO movimientos (id_aperturas_cierres, id_usuario, id_servicio, numero_caja, monto, medio_pago, fecha, hora, codigo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id_aperturas_cierres, id_usuario, id_servicio, numero_caja, monto, medio_pago, fecha, hora, codigo]
        );
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Actualizar movimiento
exports.updateMovimiento = async (req, res) => {
    const { id } = req.params;
    const {
        id_aperturas_cierres,
        id_usuario,
        id_servicio,
        numero_caja,
        monto,
        medio_pago,
        fecha,
        hora,
        codigo,
    } = req.body;

    try {
        const [result] = await db.query(
            'UPDATE movimientos SET id_aperturas_cierres = ?, id_usuario = ?, id_servicio = ?, numero_caja = ?, monto = ?, medio_pago = ?, fecha = ?, hora = ?, codigo = ? WHERE id = ?',
            [id_aperturas_cierres, id_usuario, id_servicio, numero_caja, monto, medio_pago, fecha, hora, codigo, id]
        );
        if (result.affectedRows === 0)
            return res.status(404).json({ message: 'Movimiento no encontrado' });
        res.json({ message: 'Movimiento actualizado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Eliminar movimiento
exports.deleteMovimiento = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM movimientos WHERE id = ?', [id]);
        if (result.affectedRows === 0)
            return res.status(404).json({ message: 'Movimiento no encontrado' });
        res.json({ message: 'Movimiento eliminado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
