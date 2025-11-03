const db = require('../../config/db.config');

// Obtener todas las aperturas/cierres
exports.getAllAperturasCierres = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;
        const search = req.query.search ? `%${req.query.search.toLowerCase()}%` : null;

        const filtros = [];
        const params = [];

        if (req.query.id_usuario_apertura) {
            filtros.push('ac.id_usuario_apertura = ?');
            params.push(req.query.id_usuario_apertura);
        }

        if (req.query.id_usuario_cierre) {
            filtros.push('ac.id_usuario_cierre = ?');
            params.push(req.query.id_usuario_cierre);
        }

        if (req.query.id_usuario && !req.query.id_usuario_apertura && !req.query.id_usuario_cierre) {
            filtros.push('(ac.id_usuario_apertura = ? OR ac.id_usuario_cierre = ?)');
            params.push(req.query.id_usuario, req.query.id_usuario);
        }

        if (req.query.numero_caja) {
            filtros.push('ac.numero_caja = ?');
            params.push(req.query.numero_caja);
        }

        if (req.query.estado) {
            filtros.push('ac.estado = ?');
            params.push(req.query.estado);
        }

        if (req.query.fecha_inicio) {
            filtros.push('ac.fecha_apertura >= ?');
            params.push(req.query.fecha_inicio);
        }

        if (req.query.fecha_fin) {
            filtros.push('ac.fecha_apertura <= ?');
            params.push(req.query.fecha_fin);
        }

        if (search) {
            filtros.push(`
          (
            LOWER(u1.username) LIKE ? OR
            LOWER(u2.username) LIKE ? OR
            LOWER(cj.nombre) LIKE ? OR
            LOWER(ac.estado) LIKE ?
          )
        `);
            params.push(search, search, search, search);
        }

        const whereClause = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

        // Conteo total
        const [countResult] = await db.query(
            `
                SELECT COUNT(*) AS total
                FROM aperturas_cierres ac
                LEFT JOIN users u1 ON ac.id_usuario_apertura = u1.id
                LEFT JOIN users u2 ON ac.id_usuario_cierre = u2.id
                JOIN cajas cj ON ac.numero_caja = cj.numero_caja
                ${whereClause}`,
            params
        );
        const total = countResult[0].total;

        // Consulta paginada
        const [results] = await db.query(
            `
            SELECT 
              ac.*,
              u1.username AS nombre_usuario_apertura,
              u2.username AS nombre_usuario_cierre,
              cj.nombre AS nombre_caja,
              COALESCE(mov.total_efectivo_mov, 0) AS total_efectivo_mov,
              COALESCE(mov.total_tarjeta_mov, 0) AS total_tarjeta_mov,
              COALESCE(mov.total_general_mov, 0) AS total_general_mov
            FROM aperturas_cierres ac
            LEFT JOIN (
              SELECT 
                id_aperturas_cierres,
                SUM(CASE WHEN medio_pago = 'EFECTIVO' THEN monto ELSE 0 END) AS total_efectivo_mov,
                SUM(CASE WHEN medio_pago = 'TARJETA' THEN monto ELSE 0 END) AS total_tarjeta_mov,
                SUM(monto) AS total_general_mov
              FROM movimientos
              GROUP BY id_aperturas_cierres
            ) mov ON mov.id_aperturas_cierres = ac.id
            LEFT JOIN users u1 ON ac.id_usuario_apertura = u1.id
            LEFT JOIN users u2 ON ac.id_usuario_cierre = u2.id
            JOIN cajas cj ON ac.numero_caja = cj.numero_caja
            ${whereClause}
            ORDER BY ac.fecha_apertura DESC, ac.hora_apertura DESC
            LIMIT ? OFFSET ?
            `,
            [...params, pageSize, offset]
        );

        res.json({ total, page, pageSize, data: results });
    } catch (error) {
        console.error('Error al obtener aperturas/cierres:', error);
        res.status(500).json({ error: 'Error al obtener datos' });
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
