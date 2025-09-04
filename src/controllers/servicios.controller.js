const db = require('../config/db.config');

// Obtener todos los servicios
exports.getAllServicios = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const search = req.query.search ? `%${req.query.search}%` : null;
        const offset = (page - 1) * pageSize;

        let totalQuery = 'SELECT COUNT(*) AS total FROM servicios';
        let dataQuery = 'SELECT * FROM servicios WHERE estado = "activo"';

        let countParams = [];
        let dataParams = [];

        if (search) {
            totalQuery += ' WHERE nombre LIKE ? OR tipo LIKE ? OR estado LIKE ?';
            dataQuery += ' WHERE nombre LIKE ? OR tipo LIKE ? OR estado LIKE ?';
            countParams = [search, search, search];
            dataParams = [search, search, search];
        }

        dataQuery += ' ORDER BY id DESC LIMIT ? OFFSET ?';
        dataParams.push(pageSize, offset);

        const [[{ total }]] = await db.query(totalQuery, countParams);
        const [results] = await db.query(dataQuery, dataParams);

        res.json({ total, page, pageSize, data: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getTiposServicios = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT DISTINCT tipo FROM servicios ORDER BY tipo ASC');
        const tipos = rows.map(r => r.tipo);
        res.json(tipos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Obtener un servicio por ID
exports.getServicioById = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM servicios WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Servicio no encontrado' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Crear un nuevo servicio
exports.createServicio = async (req, res) => {
    const { nombre, tipo, precio, descripcion, estado = 'activo' } = req.body;
    if (!nombre || !tipo || !precio) {
        return res.status(400).json({ error: 'nombre, tipo y precio son requeridos' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO servicios (nombre, tipo, precio, descripcion, estado) VALUES (?, ?, ?, ?, ?)',
            [nombre, tipo, precio, descripcion, estado]
        );
        res
            .status(201)
            .json({ id: result.insertId, nombre, tipo, precio, descripcion, estado });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Actualizar un servicio
exports.updateServicio = async (req, res) => {
    const { id } = req.params;
    const { nombre, tipo, precio, descripcion, estado } = req.body;

    try {
        const [result] = await db.query(
            'UPDATE servicios SET nombre = ?, tipo = ?, precio = ?, descripcion = ?, estado = ? WHERE id = ?',
            [nombre, tipo, precio, descripcion, estado, id]
        );
        if (result.affectedRows === 0)
            return res.status(404).json({ message: 'Servicio no encontrado' });
        res.json({ message: 'Servicio actualizado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Eliminar un servicio
exports.deleteServicio = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM servicios WHERE id = ?', [id]);
        if (result.affectedRows === 0)
            return res.status(404).json({ message: 'Servicio no encontrado' });
        res.json({ message: 'Servicio eliminado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
