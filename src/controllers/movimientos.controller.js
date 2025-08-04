const db = require('../config/db.config');

async function existsInTable(table, column, value) {
    const [rows] = await db.query(`SELECT 1 FROM ?? WHERE ?? = ? LIMIT 1`, [table, column, value]);
    return rows.length > 0;
}

// Obtener todos los movimientos
exports.getAllMovimientos = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const search = req.query.search ? `%${req.query.search}%` : null;
        const offset = (page - 1) * pageSize;

        let totalQuery = 'SELECT COUNT(*) AS total FROM movimientos';
        let dataQuery = 'SELECT * FROM movimientos';

        let countParams = [];
        let dataParams = [];

        if (search) {
            totalQuery += ' WHERE codigo LIKE ? OR id_usuario LIKE ?';
            dataQuery += ' WHERE codigo LIKE ? OR id_usuario LIKE ?';
            countParams = [search, search];
            dataParams = [search, search];
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

    // Campos obligatorios
    if (
        !id_aperturas_cierres ||
        !id_usuario ||
        !id_servicio ||
        !numero_caja ||
        monto === undefined || monto === null ||
        !medio_pago ||
        !fecha ||
        !hora
    ) {
        return res.status(400).json({ error: 'Todos los campos obligatorios deben estar presentes' });
    }

    // Validar monto numérico y positivo
    if (isNaN(monto) || Number(monto) <= 0) {
        return res.status(400).json({ error: 'Monto debe ser un número positivo' });
    }

    try {
        // Validar existencia claves foráneas
        const existsApertura = await existsInTable('aperturas_cierres', 'id', id_aperturas_cierres);
        if (!existsApertura) return res.status(400).json({ error: 'id_aperturas_cierres no existe' });

        const existsUsuario = await existsInTable('users', 'id', id_usuario);
        if (!existsUsuario) return res.status(400).json({ error: 'id_usuario no existe' });

        const existsServicio = await existsInTable('servicios', 'id', id_servicio);
        if (!existsServicio) return res.status(400).json({ error: 'id_servicio no existe' });

        const existsCaja = await existsInTable('cajas', 'numero_caja', numero_caja);
        if (!existsCaja) return res.status(400).json({ error: 'numero_caja no existe' });

        // Puedes validar formatos de fecha y hora si quieres (opcional)
        // Insertar movimiento
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

    // Campos obligatorios similares a create
    if (
        !id_aperturas_cierres ||
        !id_usuario ||
        !id_servicio ||
        !numero_caja ||
        monto === undefined || monto === null ||
        !medio_pago ||
        !fecha ||
        !hora
    ) {
        return res.status(400).json({ error: 'Todos los campos obligatorios deben estar presentes' });
    }

    if (isNaN(monto) || Number(monto) <= 0) {
        return res.status(400).json({ error: 'Monto debe ser un número positivo' });
    }

    try {
        // Validar existencia claves foráneas
        const existsApertura = await existsInTable('aperturas_cierres', 'id', id_aperturas_cierres);
        if (!existsApertura) return res.status(400).json({ error: 'id_aperturas_cierres no existe' });

        const existsUsuario = await existsInTable('users', 'id', id_usuario);
        if (!existsUsuario) return res.status(400).json({ error: 'id_usuario no existe' });

        const existsServicio = await existsInTable('servicios', 'id', id_servicio);
        if (!existsServicio) return res.status(400).json({ error: 'id_servicio no existe' });

        const existsCaja = await existsInTable('cajas', 'numero_caja', numero_caja);
        if (!existsCaja) return res.status(400).json({ error: 'numero_caja no existe' });

        // Actualizar movimiento
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
