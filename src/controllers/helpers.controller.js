const db = require('../config/db.config');

exports.getMetadata = async (req, res) => {
    try {

        const {
            usuarios = '1',
            servicios = '1',
            cajas = '1',
            mediosPago = '1'
        } = req.query;

        const result = {};

        if (usuarios === '1') {
            const [usuariosData] = await db.query(`
        SELECT DISTINCT u.id, u.username AS nombre 
        FROM movimientos m
        JOIN users u ON m.id_usuario = u.id
        ORDER BY nombre ASC
      `);
            result.usuarios = usuariosData;
        }

        if (servicios === '1') {
            const [serviciosData] = await db.query(`
        SELECT DISTINCT s.id, s.nombre 
        FROM movimientos m
        JOIN servicios s ON m.id_servicio = s.id
        ORDER BY nombre ASC
      `);
            result.servicios = serviciosData;
        }

        if (cajas === '1') {
            const [cajasData] = await db.query(`
        SELECT DISTINCT c.numero_caja, c.nombre 
        FROM movimientos m
        JOIN cajas c ON m.numero_caja = c.numero_caja
        ORDER BY c.numero_caja ASC
      `);
            result.cajas = cajasData;
        }

        if (mediosPago === '1') {
            result.mediosPago = ['EFECTIVO', 'TARJETA'];
        }

        res.json(result);
    } catch (error) {
        console.error('Error en getMetadata:', error.message);
        res.status(500).json({ error: 'Error al obtener metadata' });
    }
};

exports.getResumenMetadata = async (req, res) => {
    try {
        const result = {};

        // Total de usuarios únicos
        const [[{ total_usuarios }]] = await db.query(`
            SELECT COUNT(DISTINCT id_usuario) AS total_usuarios
            FROM movimientos
        `);
        result.totalUsuarios = total_usuarios;

        // Total de movimientos
        const [[{ total_movimientos }]] = await db.query(`
            SELECT COUNT(*) AS total_movimientos
            FROM movimientos
        `);
        result.totalMovimientos = total_movimientos;

        // Total de servicios únicos
        const [[{ total_servicios }]] = await db.query(`
            SELECT COUNT(DISTINCT id_servicio) AS total_servicios
            FROM movimientos
        `);
        result.totalServicios = total_servicios;

        // Total de cajas únicas
        const [[{ total_cajas }]] = await db.query(`
            SELECT COUNT(DISTINCT numero_caja) AS total_cajas
            FROM movimientos
        `);
        result.totalCajas = total_cajas;

        // Distribución por medio de pago (cantidad de transacciones)
        const [conteoPorMedio] = await db.query(`
            SELECT medio_pago, COUNT(*) AS total
            FROM movimientos
            GROUP BY medio_pago
        `);
        result.distribucionMediosPago = conteoPorMedio.reduce((acc, row) => {
            acc[row.medio_pago] = row.total;
            return acc;
        }, {});

        // Función auxiliar para obtener sumas por medio de pago en un rango de fechas
        const getGananciasPorRango = async (rangoSQL) => {
            const [rows] = await db.query(`
                SELECT medio_pago, SUM(monto) AS total_monto
                FROM movimientos
                WHERE ${rangoSQL}
                GROUP BY medio_pago
            `);
            const totales = rows.reduce((acc, row) => {
                acc[row.medio_pago] = parseFloat(row.total_monto || 0);
                return acc;
            }, {});
            return {
                EFECTIVO: totales.EFECTIVO || 0,
                TARJETA: totales.TARJETA || 0,
                TOTAL: (totales.EFECTIVO || 0) + (totales.TARJETA || 0)
            };
        };

        // Ganancias totales
        const [montosPorMedio] = await db.query(`
            SELECT medio_pago, SUM(monto) AS total_monto
            FROM movimientos
            GROUP BY medio_pago
        `);
        const gananciasTotales = montosPorMedio.reduce((acc, row) => {
            acc[row.medio_pago] = parseFloat(row.total_monto || 0);
            return acc;
        }, {});
        result.totalGanancias = {
            EFECTIVO: gananciasTotales.EFECTIVO || 0,
            TARJETA: gananciasTotales.TARJETA || 0,
            TOTAL: (gananciasTotales.EFECTIVO || 0) + (gananciasTotales.TARJETA || 0),
        };

        // Ganancias por rangos
        result.totalGananciasHoy = await getGananciasPorRango(`DATE(fecha) = CURDATE()`);
        result.totalGananciasSemana = await getGananciasPorRango(`YEARWEEK(fecha, 1) = YEARWEEK(CURDATE(), 1)`);
        result.totalGananciasMes = await getGananciasPorRango(`YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE())`);
        result.totalGananciasAnio = await getGananciasPorRango(`YEAR(fecha) = YEAR(CURDATE())`);

        res.json(result);

    } catch (error) {
        console.error('Error en getResumenMetadata:', error.message);
        res.status(500).json({ error: 'Error al obtener resumen de metadata' });
    }
};



