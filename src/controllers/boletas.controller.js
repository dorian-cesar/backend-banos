const axios = require("axios");
const db = require("../config/db.config");
require("dotenv").config();

// Configuración LibreDTE
const API_URL = process.env.LIBREDTE_API_URL;
const API_KEY = process.env.LIBREDTE_API_KEY;
const EMISOR_RUT = process.env.EMISOR_RUT;
const EMISOR_DV = process.env.EMISOR_DV;

const AUTH_HEADERS = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};

// --- Función para crear payload según producto ---
function crearPayload(producto) {
  return {
    Encabezado: {
      IdDoc: { TipoDTE: 39 },
      Emisor: {
        RUTEmisor: `${EMISOR_RUT}-${EMISOR_DV}`,
        RznSoc: "INMOBILIARIA E INVERSIONES P Y R S.A.",
        GiroEmis: "OBRAS MENORES EN CONSTRUCCIÓN",
        DirOrigen: "SAN BORJA N1251",
        CmnaOrigen: "ESTACION CENTRAL",
        CiudadOrigen: "SANTIAGO",
        Telefono: "225603700",
      },
      Receptor: {
        RUTRecep: "66666666-6",
        RznSocRecep: "Consumidor final",
      },
    },
    Detalle: [
      { NmbItem: producto.nombre, QtyItem: 1, PrcItem: producto.precio },
    ],
  };
}

// --- Controlador para emitir boleta ---
exports.emitirBoleta = async (req, res) => {
  const { nombre, precio } = req.body;

  if (!nombre || !precio) {
    return res.status(400).json({ error: "Faltan datos del producto" });
  }

  try {
    const producto = { nombre, precio };
    const payload = crearPayload(producto);

    // 1 - Emitir temporal
    const temporalRes = await axios.post(
      `${API_URL}/dte/documentos/emitir`,
      payload,
      {
        headers: AUTH_HEADERS,
        params: { formato: "json" },
      }
    );
    const codigoTemporal = temporalRes.data.codigo;

    // 2 - Emitir definitivo
    const definitivoRes = await axios.post(
      `${API_URL}/dte/documentos/generar`,
      {
        codigo: codigoTemporal,
        dte: 39,
        emisor: parseInt(EMISOR_RUT),
        receptor: 66666666,
      },
      {
        headers: AUTH_HEADERS,
        params: {
          empresa: `${EMISOR_RUT}-${EMISOR_DV}`,
          formato: "json",
          getXML: 0,
          links: 0,
          email: 0,
          retry: 1,
          gzip: 0,
        },
      }
    );

    const folio = definitivoRes.data.folio;

    // Responder inmediatamente al frontend
    res.status(201).json({ message: "Boleta emitida", folio });

    // --- Lo siguiente ocurre en background (sin bloquear al cliente) ---
    (async () => {
      try {
        // 3 - Esperar aceptación del SII
        const estadosAceptados = ["REC", "EPR", "ACE", "PEN"];
        let aceptado = false;
        for (let i = 0; i < 5; i++) {
          const estadoRes = await axios.get(
            `${API_URL}/dte/dte_emitidos/estado/39/${folio}/${EMISOR_RUT}`,
            { headers: AUTH_HEADERS, params: { avanzado: 0 } }
          );
          const estado = estadoRes.data.revision_estado;
          if (estadosAceptados.includes(estado)) {
            aceptado = true;
            break;
          }
          if (estado === "RECH") throw new Error("DTE rechazado por el SII");
          await new Promise((r) => setTimeout(r, 3000));
        }
        if (!aceptado)
          throw new Error("DTE sigue pendiente después de varios intentos");

        // 4 - Obtener XML Base64
        const xmlRes = await axios.get(
          `${API_URL}/dte/dte_emitidos/xml/39/${folio}/${EMISOR_RUT}`,
          { headers: AUTH_HEADERS }
        );
        const xmlBase64 = xmlRes.data;
        if (!xmlBase64)
          throw new Error("No se recibió XML en Base64 del DTE emitido");

        // 5 - Guardar en MySQL
        await db.query(
          `INSERT INTO boletas (folio, producto, precio, fecha, estado_sii, xml_base64) 
            VALUES (?, ?, ?, NOW(), ?, ?)`,
          [folio, nombre, precio, "Enviado al SII", xmlBase64]
        );

        console.log(`Boleta ${folio} guardada en DB`);
      } catch (bgErr) {
        console.error("Error en proceso background de boleta:", bgErr.message);
      }
    })();
  } catch (err) {
    console.error(
      "Error en emisión de boleta:",
      err.response?.data || err.message
    );
    res.status(500).json({ error: err.message });
  }
};
