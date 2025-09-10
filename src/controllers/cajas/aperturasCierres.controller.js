const pool = require('../../config/db.config');

exports.abrirCaja = async (req, res) => {
    const { numero_caja, monto_inicial, observaciones, id_usuario_apertura } = req.body;

    if (!numero_caja) {
        return res.status(400).json({
            success: false,
            error: 'Numero de caja no encontrado.',
        });
    }

    // Validaciones
    if (!monto_inicial || isNaN(monto_inicial) || parseFloat(monto_inicial) <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Monto inicial inválido. Debe ser un número mayor a 0.',
        });
    }

    if (!id_usuario_apertura || isNaN(id_usuario_apertura)) {
        return res.status(400).json({
            success: false,
            error: 'ID de usuario inválido',
        });
    }

    const fecha = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const hora = new Date().toTimeString().slice(0, 8);   // HH:MM:SS

    try {
        // Validar que la caja exista y esté activa
        const [cajaData] = await pool.execute(
            'SELECT numero_caja FROM cajas WHERE numero_caja = ? AND estado = "activa" LIMIT 1',
            [numero_caja]
        );

        if (cajaData.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Caja no registrada o inactiva.',
            });
        }

        // Verificar si ya hay una apertura activa
        const [yaAbierta] = await pool.execute(
            'SELECT id FROM aperturas_cierres WHERE numero_caja = ? AND estado = "abierta" LIMIT 1',
            [numero_caja]
        );

        if (yaAbierta.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Ya existe una caja abierta para este número.',
            });
        }

        // Insertar nueva apertura
        const [result] = await pool.execute(
            `INSERT INTO aperturas_cierres 
          (numero_caja, id_usuario_apertura, fecha_apertura, hora_apertura, monto_inicial, estado, observaciones)
         VALUES (?, ?, ?, ?, ?, 'abierta', ?)`,
            [
                numero_caja,
                id_usuario_apertura,
                fecha,
                hora,
                parseFloat(monto_inicial),
                observaciones || null,
            ]
        );

        res.json({
            success: true,
            id: result.insertId,
            numero_caja: numero_caja,
            fecha_apertura: fecha,
            hora_apertura: hora,
            monto_inicial: parseFloat(monto_inicial),
            estado: 'abierta',
            observaciones: observaciones || null,
        });
    } catch (err) {
        console.error('Error al abrir caja:', err);
        res.status(500).json({
            success: false,
            error: 'No se pudo abrir la caja.',
        });
    }
};

exports.cerrarCaja = async (req, res) => {
    const { id_aperturas_cierres, id_usuario_cierre, observaciones, nombre_cajero } = req.body;

    if (!id_aperturas_cierres || !id_usuario_cierre) {
        return res.status(400).json({
            success: false,
            error: 'Datos obligatorios faltantes.',
        });
    }

    try {
        // Verificar que la sesión exista y esté abierta
        const [sesiones] = await pool.execute(
            `SELECT estado FROM aperturas_cierres WHERE id = ?`,
            [id_aperturas_cierres]
        );

        if (sesiones.length === 0) {
            return res.status(404).json({ success: false, error: 'Sesión no encontrada.' });
        }

        if (sesiones[0].estado !== 'abierta') {
            return res.status(400).json({ success: false, error: 'La sesión ya está cerrada.' });
        }

        // Obtener totales desde la tabla movimientos CONSIDERANDO RETIROS
        const [[totales]] = await pool.execute(
            `SELECT 
           SUM(CASE WHEN medio_pago = 'EFECTIVO' AND id_servicio != 999 THEN monto ELSE 0 END) AS total_efectivo,
           SUM(CASE WHEN medio_pago = 'TARJETA' THEN monto ELSE 0 END) AS total_tarjeta,
           SUM(CASE WHEN id_servicio = 999 THEN monto ELSE 0 END) AS total_retiros
         FROM movimientos
         WHERE id_aperturas_cierres = ?`,
            [id_aperturas_cierres]
        );

        const total_efectivo = totales.total_efectivo || 0;
        const total_tarjeta = totales.total_tarjeta || 0;
        const total_retiros = Math.abs(totales.total_retiros) || 0; // Convertir a positivo

        const now = new Date();
        const fecha_cierre = now.toISOString().split('T')[0];
        const hora_cierre = now.toTimeString().split(':').slice(0, 2).join(':');

        // Obtener monto inicial y datos de la caja
        const [[aperturaInfo]] = await pool.execute(
            `SELECT a.monto_inicial, a.numero_caja, c.nombre as nombre_caja 
        FROM aperturas_cierres a
        LEFT JOIN cajas c ON a.numero_caja = c.numero_caja
        WHERE a.id = ?`,
            [id_aperturas_cierres]
        );

        const monto_inicial = aperturaInfo.monto_inicial || 0;
        const numero_caja = aperturaInfo.numero_caja;
        const nombre_caja = aperturaInfo.nombre_caja || `Caja ${numero_caja}`;

        // Obtener nombre del usuario que cierra (admin/supervisor)
        const [[usuarioInfo]] = await pool.execute(
            `SELECT username FROM users WHERE id = ?`,
            [id_usuario_cierre]
        );

        const nombre_usuario_cierre = usuarioInfo.username;

        // Calcular balance final (monto inicial + efectivo - retiros)
        const balance_final = Number(monto_inicial) + Number(total_efectivo) - Number(total_retiros);

        // Actualizar la sesión con los nuevos campos
        await pool.execute(
            `UPDATE aperturas_cierres
         SET estado = 'cerrada',
             fecha_cierre = ?,
             hora_cierre = ?,
             id_usuario_cierre = ?,
             total_efectivo = ?,
             total_tarjeta = ?,
             total_retiros = ?,
             balance_final = ?,
             observaciones = ?
         WHERE id = ?`,
            [
                fecha_cierre,
                hora_cierre,
                id_usuario_cierre,
                total_efectivo,
                total_tarjeta,
                total_retiros,
                balance_final,
                observaciones || null,
                id_aperturas_cierres,
            ]
        );

        res.json({
            success: true,
            mensaje: 'Caja cerrada correctamente.',
            data: {
                monto_inicial,
                total_efectivo,
                total_tarjeta,
                total_retiros,
                balance_final,
                fecha_cierre,
                hora_cierre,
                nombre_cajero: nombre_cajero || 'Cajero',
                nombre_usuario_cierre: nombre_usuario_cierre,
                nombre_caja: nombre_caja
            },
        });
    } catch (err) {
        console.error('Error al cerrar la caja:', err);
        res.status(500).json({
            success: false,
            error: 'Error interno al cerrar la caja.',
        });
    }
};

exports.registrarRetiro = async (req, res) => {
    try {
        const { numero_caja, monto, id_usuario, motivo, nombre_cajero } = req.body;

        // Validaciones
        if (!monto || isNaN(monto) || parseFloat(monto) <= 0) {
            return res.status(400).json({ success: false, message: 'Monto inválido' });
        }

        if (!id_usuario || isNaN(id_usuario)) {
            return res.status(400).json({ success: false, message: 'ID de usuario inválido' });
        }

        // Obtener ID de la sesión de caja abierta
        const [apertura] = await pool.execute(
            'SELECT id FROM aperturas_cierres WHERE numero_caja = ? AND estado = "abierta" ORDER BY id DESC LIMIT 1',
            [numero_caja]
        );

        if (apertura.length === 0) {
            return res.status(400).json({ success: false, message: 'No hay caja abierta' });
        }

        const id_aperturas_cierres = apertura[0].id;

        // Obtener información del usuario que AUTORIZA el retiro (admin/recaudador)
        const [usuario] = await pool.execute(
            'SELECT username FROM users WHERE id = ?',
            [id_usuario]
        );

        if (usuario.length === 0) {
            return res.status(400).json({ success: false, message: 'Usuario no encontrado' });
        }

        const nombre_autorizador = usuario[0].username;

        // Obtener el nombre de la caja desde la tabla cajas
        const [cajaInfo] = await pool.execute(
            'SELECT nombre FROM cajas WHERE numero_caja = ?',
            [numero_caja]
        );

        const nombre_caja = cajaInfo.length > 0 ? cajaInfo[0].nombre : `Caja ${numero_caja}`;

        // Usar ID fijo para retiros (debe existir en la tabla servicios)
        const id_servicio = 999; // ID del servicio de retiros

        // Generar código único para el retiro
        const codigo = 'RET-' + Date.now();
        const fecha = new Date().toISOString().split('T')[0];
        const hora = new Date().toTimeString().split(' ')[0];

        // Insertar movimiento de retiro
        const [result] = await pool.execute(
            `INSERT INTO movimientos 
       (codigo, fecha, hora, id_servicio, monto, medio_pago, numero_caja, id_usuario, id_aperturas_cierres)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                codigo,
                fecha,
                hora,
                id_servicio, // ID válido que existe en servicios
                -Math.abs(monto), // Valor NEGATIVO
                'Retiro de efectivo',
                numero_caja,
                id_usuario,
                id_aperturas_cierres
            ]
        );

        // Preparar datos para impresión (en lugar de imprimir directamente)
        const datosImpresion = {
            codigo,
            fecha,
            hora,
            monto: Math.abs(monto), // Mostrar valor positivo en el ticket
            nombre_usuario: nombre_autorizador,  // Usuario que autoriza (admin/recaudador)
            nombre_caja,
            motivo: motivo || 'Retiro de efectivo',
            nombre_cajero: nombre_cajero || 'Cajero'  // Nombre del cajero que realiza la operación
        };

        res.json({
            success: true,
            message: 'Retiro registrado exitosamente',
            insertId: result.insertId,
            datosImpresion: datosImpresion, // Devolvemos los datos para impresión
            retiro: {
                id: result.insertId,
                codigo,
                fecha,
                hora,
                monto: -Math.abs(monto),
                medio_pago: 'Retiro de efectivo',
                id_servicio: id_servicio
            }
        });

    } catch (error) {
        console.error('Error al registrar retiro:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
};