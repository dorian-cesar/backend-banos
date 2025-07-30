const db = require('../config/db.config');

// Obtener todos los servicios
exports.getAllServicios = (req, res) => {
    db.query('SELECT * FROM servicios', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// Obtener un servicio por ID
exports.getServicioById = (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM servicios WHERE id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: 'Servicio no encontrado' });
        res.json(results[0]);
    });
};

// Crear un nuevo servicio
exports.createServicio = (req, res) => {
    const { nombre, tipo, precio, descripcion, estado = 'activo' } = req.body;
    if (!nombre || !tipo || !precio) {
        return res.status(400).json({ error: 'nombre, tipo y precio son requeridos' });
    }

    db.query(
        'INSERT INTO servicios (nombre, tipo, precio, descripcion, estado) VALUES (?, ?, ?, ?, ?)',
        [nombre, tipo, precio, descripcion, estado],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: result.insertId, nombre, tipo, precio, descripcion, estado });
        }
    );
};

// Actualizar un servicio
exports.updateServicio = (req, res) => {
    const { id } = req.params;
    const { nombre, tipo, precio, descripcion, estado } = req.body;

    db.query(
        'UPDATE servicios SET nombre = ?, tipo = ?, precio = ?, descripcion = ?, estado = ? WHERE id = ?',
        [nombre, tipo, precio, descripcion, estado, id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ message: 'Servicio no encontrado' });
            res.json({ message: 'Servicio actualizado correctamente' });
        }
    );
};

// Eliminar un servicio
exports.deleteServicio = (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM servicios WHERE id = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Servicio no encontrado' });
        res.json({ message: 'Servicio eliminado correctamente' });
    });
};
