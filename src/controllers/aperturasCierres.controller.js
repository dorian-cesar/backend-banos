const db = require('../config/db.config');

// Obtener todas las aperturas/cierres
exports.getAllAperturasCierres = (req, res) => {
    db.query('SELECT * FROM aperturas_cierres', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// Obtener por ID
exports.getAperturaCierreById = (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM aperturas_cierres WHERE id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: 'Registro no encontrado' });
        res.json(results[0]);
    });
};

// Crear nuevo registro
exports.createAperturaCierre = (req, res) => {
    const {
        numero_caja,
        id_usuario_apertura,
        id_usuario_cierre = null,
        fecha_apertura,
        hora_apertura,
        fecha_cierre = null,
        hora_cierre = null,
        monto_inicial,
        total_efectivo = 0.00,
        total_tarjeta = 0.00,
        observaciones = null,
        estado = 'abierta',
        fue_arqueada = 0,
    } = req.body;

    if (!numero_caja || !id_usuario_apertura || !fecha_apertura || !hora_apertura || monto_inicial === undefined) {
        return res.status(400).json({ error: 'Campos obligatorios: numero_caja, id_usuario_apertura, fecha_apertura, hora_apertura, monto_inicial' });
    }

    const sql = `
    INSERT INTO aperturas_cierres 
    (numero_caja, id_usuario_apertura, id_usuario_cierre, fecha_apertura, hora_apertura, fecha_cierre, hora_cierre, monto_inicial, total_efectivo, total_tarjeta, observaciones, estado, fue_arqueada)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

    db.query(
        sql,
        [numero_caja, id_usuario_apertura, id_usuario_cierre, fecha_apertura, hora_apertura, fecha_cierre, hora_cierre, monto_inicial, total_efectivo, total_tarjeta, observaciones, estado, fue_arqueada],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: result.insertId, ...req.body });
        }
    );
};

// Actualizar registro
exports.updateAperturaCierre = (req, res) => {
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
        fue_arqueada
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

    db.query(
        sql,
        [numero_caja, id_usuario_apertura, id_usuario_cierre, fecha_apertura, hora_apertura, fecha_cierre, hora_cierre, monto_inicial, total_efectivo, total_tarjeta, observaciones, estado, fue_arqueada, id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ message: 'Registro no encontrado' });
            res.json({ message: 'Registro actualizado correctamente' });
        }
    );
};

// Eliminar registro
exports.deleteAperturaCierre = (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM aperturas_cierres WHERE id = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Registro no encontrado' });
        res.json({ message: 'Registro eliminado correctamente' });
    });
};
