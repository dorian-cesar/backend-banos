const db = require('../config/db.config');

// Obtener todas las cajas
exports.getAllCajas = (req, res) => {
    db.query('SELECT * FROM cajas', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// Obtener caja por ID
exports.getCajaById = (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM cajas WHERE id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: 'Caja no encontrada' });
        res.json(results[0]);
    });
};

// Crear nueva caja
exports.createCaja = (req, res) => {
    const { numero_caja, nombre, ubicacion = null, estado = 'activa', descripcion = null } = req.body;

    if (!numero_caja || !nombre) {
        return res.status(400).json({ error: 'numero_caja y nombre son obligatorios' });
    }

    db.query(
        'INSERT INTO cajas (numero_caja, nombre, ubicacion, estado, descripcion) VALUES (?, ?, ?, ?, ?)',
        [numero_caja, nombre, ubicacion, estado, descripcion],
        (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ error: 'El número de caja ya existe' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ id: result.insertId, numero_caja, nombre, ubicacion, estado, descripcion });
        }
    );
};

// Actualizar caja
exports.updateCaja = (req, res) => {
    const { id } = req.params;
    const { numero_caja, nombre, ubicacion, estado, descripcion } = req.body;

    db.query(
        'UPDATE cajas SET numero_caja = ?, nombre = ?, ubicacion = ?, estado = ?, descripcion = ? WHERE id = ?',
        [numero_caja, nombre, ubicacion, estado, descripcion, id],
        (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ error: 'El número de caja ya existe' });
                }
                return res.status(500).json({ error: err.message });
            }
            if (result.affectedRows === 0) return res.status(404).json({ message: 'Caja no encontrada' });
            res.json({ message: 'Caja actualizada correctamente' });
        }
    );
};

// Eliminar caja
exports.deleteCaja = (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM cajas WHERE id = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Caja no encontrada' });
        res.json({ message: 'Caja eliminada correctamente' });
    });
};
