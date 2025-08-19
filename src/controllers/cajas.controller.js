const db = require('../config/db.config');

// Obtener todas las cajas
exports.getAllCajas = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;
        const search = req.query.search ? req.query.search.toLowerCase() : '';

        let params = [];

        // --- Query para contar ---
        let totalQuery = `
            SELECT COUNT(*) AS total
            FROM cajas c
        `;

        // --- Query para traer datos ---
        let dataQuery = `
            SELECT 
                c.id,
                c.numero_caja,
                c.nombre,
                c.ubicacion,
                c.estado AS estado_caja,
                c.descripcion,
                CASE 
                    WHEN EXISTS (
                        SELECT 1 
                        FROM aperturas_cierres ac
                        WHERE ac.numero_caja = c.numero_caja
                          AND ac.estado = 'abierta'
                    ) THEN 'abierta'
                    ELSE 'cerrada'
                END AS estado_apertura
            FROM cajas c
        `;

        // --- Filtro de búsqueda ---
        if (search) {
            totalQuery += ' WHERE LOWER(c.nombre) LIKE ? OR CAST(c.numero_caja AS CHAR) LIKE ?';
            dataQuery += ' WHERE LOWER(c.nombre) LIKE ? OR CAST(c.numero_caja AS CHAR) LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }

        // --- Orden y paginación ---
        dataQuery += ' ORDER BY c.id DESC LIMIT ? OFFSET ?';
        params.push(pageSize, offset);

        // --- Ejecutar consultas ---
        const [[{ total }]] = await db.query(totalQuery, params.slice(0, search ? 2 : 0));
        const [results] = await db.query(dataQuery, params);

        res.json({ total, page, pageSize, data: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};



// Obtener caja por ID
exports.getCajaById = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM cajas WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Caja no encontrada' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Crear nueva caja
exports.createCaja = async (req, res) => {
    const { numero_caja, nombre, ubicacion = null, estado = 'activa', descripcion = null } = req.body;

    if (!numero_caja || !nombre) {
        return res.status(400).json({ error: 'numero_caja y nombre son obligatorios' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO cajas (numero_caja, nombre, ubicacion, estado, descripcion) VALUES (?, ?, ?, ?, ?)',
            [numero_caja, nombre, ubicacion, estado, descripcion]
        );
        res
            .status(201)
            .json({ id: result.insertId, numero_caja, nombre, ubicacion, estado, descripcion });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'El número de caja ya existe' });
        }
        res.status(500).json({ error: err.message });
    }
};

// Actualizar caja
exports.updateCaja = async (req, res) => {
    const { id } = req.params;
    const { numero_caja, nombre, ubicacion, estado, descripcion } = req.body;

    try {
        const [result] = await db.query(
            'UPDATE cajas SET numero_caja = ?, nombre = ?, ubicacion = ?, estado = ?, descripcion = ? WHERE id = ?',
            [numero_caja, nombre, ubicacion, estado, descripcion, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Caja no encontrada' });
        res.json({ message: 'Caja actualizada correctamente' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'El número de caja ya existe' });
        }
        res.status(500).json({ error: err.message });
    }
};

// Eliminar caja
exports.deleteCaja = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM cajas WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Caja no encontrada' });
        res.json({ message: 'Caja eliminada correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
