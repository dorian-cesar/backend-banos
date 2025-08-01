const db = require('../config/db.config');

// Obtener todas las aperturas/cierres
exports.getAllAperturasCierres = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM aperturas_cierres');
        const [results] = await db.query(
            'SELECT * FROM aperturas_cierres ORDER BY id DESC LIMIT ? OFFSET ?',
            [pageSize, offset]
        );

        res.json({ total, page, pageSize, data: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};



// Obtener por ID
exports.getAperturaCierreById = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM aperturas_cierres WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Registro no encontrado' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
// Crear nuevo registro
exports.createAperturaCierre = async (req, res) => {
    const {
        numero_caja,
        id_usuario_apertura,
        id_usuario_cierre = null,
        fecha_apertura,
        hora_apertura,
        fecha_cierre = null,
        hora_cierre = null,
        monto_inicial,
        total_efectivo = 0.0,
        total_tarjeta = 0.0,
        observaciones = null,
        estado = 'abierta',
        fue_arqueada = 0,
    } = req.body;

    if (
        numero_caja === undefined ||
        id_usuario_apertura === undefined ||
        !fecha_apertura ||
        !hora_apertura ||
        monto_inicial === undefined
    ) {
        return res.status(400).json({
            error:
                'Campos obligatorios: numero_caja, id_usuario_apertura, fecha_apertura, hora_apertura, monto_inicial',
        });
    }

    const sql = `
      INSERT INTO aperturas_cierres 
      (numero_caja, id_usuario_apertura, id_usuario_cierre, fecha_apertura, hora_apertura, fecha_cierre, hora_cierre, monto_inicial, total_efectivo, total_tarjeta, observaciones, estado, fue_arqueada)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
        const [result] = await db.query(sql, [
            numero_caja,
            id_usuario_apertura,
            id_usuario_cierre,
            fecha_apertura,
            hora_apertura,
            fecha_cierre,
            hora_cierre,
            monto_inicial,
            total_efectivo,
            total_tarjeta,
            observaciones,
            estado,
            fue_arqueada,
        ]);
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Actualizar registro
exports.updateAperturaCierre = async (req, res) => {
    const { id } = req.params;
    const {
        numero_caja,
        id_usuario_apertura,
        id_usuario_cierre,
        fecha_apertura,
        hora_apertura,
        fecha_cierre,
        hora_cierre,
        monto_inicial,
        total_efectivo,
        total_tarjeta,
        observaciones,
        estado,
        fue_arqueada,
    } = req.body;

    const sql = `
      UPDATE aperturas_cierres SET 
        numero_caja = ?, 
        id_usuario_apertura = ?, 
        id_usuario_cierre = ?, 
        fecha_apertura = ?, 
        hora_apertura = ?, 
        fecha_cierre = ?, 
        hora_cierre = ?, 
        monto_inicial = ?, 
        total_efectivo = ?, 
        total_tarjeta = ?, 
        observaciones = ?, 
        estado = ?, 
        fue_arqueada = ?
      WHERE id = ?
    `;

    try {
        const [result] = await db.query(sql, [
            numero_caja,
            id_usuario_apertura,
            id_usuario_cierre,
            fecha_apertura,
            hora_apertura,
            fecha_cierre,
            hora_cierre,
            monto_inicial,
            total_efectivo,
            total_tarjeta,
            observaciones,
            estado,
            fue_arqueada,
            id,
        ]);
        if (result.affectedRows === 0)
            return res.status(404).json({ message: 'Registro no encontrado' });
        res.json({ message: 'Registro actualizado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Eliminar registro
exports.deleteAperturaCierre = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM aperturas_cierres WHERE id = ?', [id]);
        if (result.affectedRows === 0)
            return res.status(404).json({ message: 'Registro no encontrado' });
        res.json({ message: 'Registro eliminado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
