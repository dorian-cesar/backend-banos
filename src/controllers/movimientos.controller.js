const db = require('../config/db.config');

// Obtener todos los movimientos
exports.getAllMovimientos = (req, res) => {
    db.query('SELECT * FROM movimientos', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// Obtener un movimiento por ID
exports.getMovimientoById = (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM movimientos WHERE id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: 'Movimiento no encontrado' });
        res.json(results[0]);
    });
};

// Crear nuevo movimiento
exports.createMovimiento = (req, res) => {
    const {
        id_aperturas_cierres,
        id_usuario,
        id_servicio,
        numero_caja,
        monto,
        medio_pago,
        fecha,
        hora,
        codigo
    } = req.body;

    if (!id_aperturas_cierres || !id_usuario || !id_servicio || !numero_caja || !monto || !medio_pago || !fecha || !hora) {
        return res.status(400).json({ error: 'Todos los campos obligatorios deben estar presentes' });
    }

    db.query(
        'INSERT INTO movimientos (id_aperturas_cierres, id_usuario, id_servicio, numero_caja, monto, medio_pago, fecha, hora, codigo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id_aperturas_cierres, id_usuario, id_servicio, numero_caja, monto, medio_pago, fecha, hora, codigo],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: result.insertId, ...req.body });
        }
    );
};

// Actualizar movimiento
exports.updateMovimiento = (req, res) => {
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
        codigo
    } = req.body;

    db.query(
        'UPDATE movimientos SET id_aperturas_cierres = ?, id_usuario = ?, id_servicio = ?, numero_caja = ?, monto = ?, medio_pago = ?, fecha = ?, hora = ?, codigo = ? WHERE id = ?',
        [id_aperturas_cierres, id_usuario, id_servicio, numero_caja, monto, medio_pago, fecha, hora, codigo, id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ message: 'Movimiento no encontrado' });
            res.json({ message: 'Movimiento actualizado correctamente' });
        }
    );
};

// Eliminar movimiento
exports.deleteMovimiento = (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM movimientos WHERE id = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Movimiento no encontrado' });
        res.json({ message: 'Movimiento eliminado correctamente' });
    });
};
