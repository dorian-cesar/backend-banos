const db = require("../../config/db.config");

exports.getMetadata = async (req, res) => {
  try {
    const {
      usuarios = "1",
      servicios = "1",
      cajas = "1",
      mediosPago = "1",
    } = req.query;

    const result = {};

    if (usuarios === "1") {
      const [usuariosData] = await db.query(`
        SELECT DISTINCT u.id, u.username AS nombre 
        FROM movimientos m
        JOIN users u ON m.id_usuario = u.id
        ORDER BY nombre ASC
      `);
      result.usuarios = usuariosData;
    }

    if (servicios === "1") {
      const [serviciosData] = await db.query(`
        SELECT DISTINCT s.id, s.nombre 
        FROM movimientos m
        JOIN servicios s ON m.id_servicio = s.id
        ORDER BY nombre ASC
      `);
      result.servicios = serviciosData;
    }

    if (cajas === "1") {
      const [cajasData] = await db.query(`
        SELECT DISTINCT c.numero_caja, c.nombre 
        FROM movimientos m
        JOIN cajas c ON m.numero_caja = c.numero_caja
        ORDER BY c.numero_caja ASC
      `);
      result.cajas = cajasData;
    }

    if (mediosPago === "1") {
      result.mediosPago = ["EFECTIVO", "TARJETA"];
    }

    res.json(result);
  } catch (error) {
    console.error("Error en getMetadata:", error.message);
    res.status(500).json({ error: "Error al obtener metadata" });
  }
};

exports.getResumenMetadata = async (req, res) => {
  try {
    const result = {};
    // Usuarios totales (tabla users)
    const [[{ total_usuarios }]] = await db.query(`
      SELECT COUNT(*) AS total_usuarios
      FROM users
    `);
    result.totalUsuarios = Number(total_usuarios || 0);

    // Movimientos totales (tabla movimientos)
    const [[{ total_movimientos }]] = await db.query(`
      SELECT COUNT(*) AS total_movimientos
      FROM movimientos
    `);
    result.totalMovimientos = Number(total_movimientos || 0);

    // Servicios totales (tabla servicios)
    const [[{ total_servicios }]] = await db.query(`
      SELECT COUNT(*) AS total_servicios
      FROM servicios
      WHERE estado = "activo"
    `);
    result.totalServicios = Number(total_servicios || 0);

    // Cajas totales (tabla cajas)
    const [[{ total_cajas }]] = await db.query(`
      SELECT COUNT(*) AS total_cajas
      FROM cajas
    `);
    result.totalCajas = Number(total_cajas || 0);

    // (Opcional) detalle de cajas por estado (tabla cajas)
    const [[{ activas }]] = await db.query(`
      SELECT COUNT(*) AS activas
      FROM cajas
      WHERE estado = 'activa'
    `);
    const [[{ inactivas }]] = await db.query(`
      SELECT COUNT(*) AS inactivas
      FROM cajas
      WHERE estado = 'inactiva'
    `);
    result.cajasEstado = {
      activas: Number(activas || 0),
      inactivas: Number(inactivas || 0),
    };

    // (Opcional) cajas abiertas hoy (tabla aperturas_cierres)
    const [[{ abiertas_hoy }]] = await db.query(`
      SELECT COUNT(DISTINCT numero_caja) AS abiertas_hoy
      FROM aperturas_cierres
      WHERE estado = 'abierta'
        AND fecha_apertura = CURDATE()
    `);
    result.cajasAbiertasHoy = Number(abiertas_hoy || 0);
    const [conteoPorMedio] = await db.query(`
      SELECT medio_pago, COUNT(*) AS total
      FROM movimientos
      GROUP BY medio_pago
    `);
    result.distribucionMediosPago = {
      EFECTIVO: Number(
        conteoPorMedio.find((r) => r.medio_pago === "EFECTIVO")?.total || 0
      ),
      TARJETA: Number(
        conteoPorMedio.find((r) => r.medio_pago === "TARJETA")?.total || 0
      ),
    };

    // Ganancias totales por medio
    const [montosPorMedio] = await db.query(`
      SELECT medio_pago, SUM(monto) AS total_monto
      FROM movimientos
      GROUP BY medio_pago
    `);
    const efectivoTotal = Number(
      montosPorMedio.find((r) => r.medio_pago === "EFECTIVO")?.total_monto || 0
    );
    const tarjetaTotal = Number(
      montosPorMedio.find((r) => r.medio_pago === "TARJETA")?.total_monto || 0
    );
    result.totalGanancias = {
      EFECTIVO: efectivoTotal,
      TARJETA: tarjetaTotal,
      TOTAL: efectivoTotal + tarjetaTotal,
    };

    // Helper para rangos de fecha (columna DATE `fecha` en movimientos)
    const getGananciasPorRango = async (whereSql) => {
      const [rows] = await db.query(`
        SELECT medio_pago, SUM(monto) AS total_monto
        FROM movimientos
        WHERE ${whereSql}
        GROUP BY medio_pago
      `);
      const e = Number(
        rows.find((r) => r.medio_pago === "EFECTIVO")?.total_monto || 0
      );
      const t = Number(
        rows.find((r) => r.medio_pago === "TARJETA")?.total_monto || 0
      );
      return { EFECTIVO: e, TARJETA: t, TOTAL: e + t };
    };

    // Ganancias por rangos (SIEMPRE en movimientos)
    result.totalGananciasHoy = await getGananciasPorRango(`fecha = CURDATE()`);
    result.totalGananciasSemana = await getGananciasPorRango(
      `YEARWEEK(fecha, 1) = YEARWEEK(CURDATE(), 1)`
    );
    result.totalGananciasMes = await getGananciasPorRango(
      `YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE())`
    );
    result.totalGananciasAnio = await getGananciasPorRango(
      `YEAR(fecha) = YEAR(CURDATE())`
    );

    res.json(result);
  } catch (error) {
    console.error("Error en getResumenMetadata:", error.message);
    res.status(500).json({ error: "Error al obtener resumen de metadata" });
  }
};

exports.getResumenPorCaja = async (req, res) => {
  try {
    const { fecha } = req.query; // "YYYY-MM-DD" opcional
    const fechaFiltro = fecha || null;

    // 1) Por-sesión (igual que antes, pero separando retiros)
    const [rows] = await db.query(
      `
      SELECT
        c.id,
        c.numero_caja,
        c.nombre,
        c.ubicacion,
        c.estado AS estado_caja,
        c.descripcion,

        ac.estado AS estado_apertura,

        ua.id       AS apertura_usuario_id,
        ua.username AS apertura_usuario_nombre,
        ua.email    AS apertura_usuario_email,

        ac.fecha_apertura AS apertura_fecha,
        ac.hora_apertura  AS apertura_hora,
        ac.monto_inicial  AS monto_inicial,

        ac.fecha_cierre    AS cierre_fecha,
        ac.hora_cierre     AS cierre_hora,

        COALESCE(SUM(CASE WHEN m.id_servicio <> 999 AND m.medio_pago = 'EFECTIVO' AND m.fecha = COALESCE(?, m.fecha) THEN m.monto END), 0) AS efectivo,
        COALESCE(SUM(CASE WHEN m.id_servicio <> 999 AND m.medio_pago = 'TARJETA' AND m.fecha = COALESCE(?, m.fecha) THEN m.monto END), 0) AS tarjeta,
        COALESCE(SUM(CASE WHEN m.id_servicio <> 999 AND m.fecha = COALESCE(?, m.fecha) THEN m.monto END), 0) AS total,
        COALESCE(SUM(CASE WHEN m.id_servicio = 999 AND m.fecha = COALESCE(?, m.fecha) THEN m.monto END), 0) AS retiros,
        COALESCE(SUM(CASE WHEN m.id_servicio <> 999 AND m.fecha = COALESCE(?, m.fecha) THEN 1 END), 0) AS transacciones,
        MIN(CASE WHEN m.fecha = COALESCE(?, m.fecha) THEN m.hora END) AS primera_transaccion,
        MAX(CASE WHEN m.fecha = COALESCE(?, m.fecha) THEN m.hora END) AS ultima_transaccion,
        MIN(CASE WHEN m.fecha = COALESCE(?, m.fecha) THEN m.fecha END) AS fecha_primera_transaccion,
        MAX(CASE WHEN m.fecha = COALESCE(?, m.fecha) THEN m.fecha END) AS fecha_ultima_transaccion

      FROM cajas c

      LEFT JOIN (
        SELECT *
        FROM (
          SELECT
            ac.*,
            ROW_NUMBER() OVER (
              PARTITION BY ac.numero_caja
              ORDER BY
                (ac.estado = 'abierta') DESC,
                (ac.fecha_apertura = COALESCE(?, CURDATE()) OR ac.fecha_cierre = COALESCE(?, CURDATE())) DESC,
                ac.id DESC
            ) AS rn
          FROM aperturas_cierres ac
        ) z
        WHERE z.rn = 1
      ) ac
        ON ac.numero_caja = c.numero_caja

      LEFT JOIN users ua
        ON ua.id = ac.id_usuario_apertura

      LEFT JOIN movimientos m
        ON m.id_aperturas_cierres = ac.id

      WHERE c.estado <> 'inactiva'

      GROUP BY
        c.id, c.numero_caja, c.nombre, c.ubicacion, c.estado, c.descripcion,
        ac.id, ac.estado, ac.fecha_apertura, ac.hora_apertura, ac.monto_inicial,
        ac.fecha_cierre, ac.hora_cierre,
        ua.id, ua.username, ua.email

      ORDER BY c.numero_caja ASC
      `,
      [
        fechaFiltro, // efectivo
        fechaFiltro, // tarjeta
        fechaFiltro, // total
        fechaFiltro, // retiros
        fechaFiltro, // transacciones
        fechaFiltro, // primera_transaccion
        fechaFiltro, // ultima_transaccion
        fechaFiltro, // fecha_primera_transaccion
        fechaFiltro, // fecha_ultima_transaccion
        fechaFiltro, // ac.fecha_apertura
        fechaFiltro, // ac.fecha_cierre
      ]
    );

    // 2) Totales del DÍA (todos los movimientos de la fecha, sin importar sesión)
    const [totDiaRows] = await db.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN id_servicio <> 999 AND medio_pago = 'EFECTIVO' THEN monto END), 0) AS efectivo,
        COALESCE(SUM(CASE WHEN id_servicio <> 999 AND medio_pago = 'TARJETA'  THEN monto END), 0) AS tarjeta,
        COALESCE(SUM(CASE WHEN id_servicio <> 999 THEN monto END), 0) AS total,
        COALESCE(SUM(CASE WHEN id_servicio = 999 THEN monto END), 0) AS retiros,
        COUNT(*) AS transacciones
      FROM movimientos
      WHERE fecha = COALESCE(?, CURDATE())
      `,
      [fechaFiltro]
    );
    const totalesDia = totDiaRows?.[0] || {
      efectivo: 0,
      tarjeta: 0,
      total: 0,
      retiros: 0,
      transacciones: 0,
    };

    // Mapear resultados (solo cajas activas, por seguridad)
    const cajas = rows
      .filter((r) => r.estado_caja !== "inactiva")
      .map((r) => ({
        id: r.id,
        numero_caja: r.numero_caja,
        nombre: r.nombre,
        ubicacion: r.ubicacion,
        estado_caja: r.estado_caja,
        descripcion: r.descripcion,
        estado_apertura: r.estado_apertura,
        apertura: r.estado_apertura
          ? {
              usuario: r.apertura_usuario_id
                ? {
                    id: r.apertura_usuario_id,
                    nombre: r.apertura_usuario_nombre,
                    email: r.apertura_usuario_email,
                  }
                : null,
              fecha: r.apertura_fecha,
              hora: r.apertura_hora,
            }
          : null,
        cierre:
          r.estado_apertura === "cerrada"
            ? {
                fecha: r.cierre_fecha || null,
                hora: r.cierre_hora || null,
              }
            : null,
        monto_inicial: r.monto_inicial ?? 0,
        efectivo: r.efectivo,
        tarjeta: r.tarjeta,
        total: r.total,
        retiros: r.retiros,
        transacciones: r.transacciones,
        primera_transaccion: r.primera_transaccion,
        ultima_transaccion: r.ultima_transaccion,
        fecha_primera_transaccion: r.fecha_primera_transaccion,
        fecha_ultima_transaccion: r.fecha_ultima_transaccion,
      }));

    res.json({
      fecha: fecha || null,
      cajas,
      totales: totalesDia,
    });
  } catch (error) {
    console.error("Error en getResumenPorCaja:", error.message);
    res.status(500).json({ error: "Error al obtener resumen por caja" });
  }
};
