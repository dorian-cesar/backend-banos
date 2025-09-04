const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const db = require("../config/db.config");
const path = require("path");
require("dotenv").config();

// Configuración SimpleAPI
const API_URL = process.env.SIMPLEAPI_URL;
const API_KEY = process.env.SIMPLEAPI_KEY;
const EMISOR_RUT = process.env.EMISOR_RUT;
const EMISOR_DV = process.env.EMISOR_DV;
const CERT_PATH = __dirname + "/../../certificado/certificado.pfx";
const CERT_PASS = process.env.CERT_PASS;
const CAF_DIRECTORY = __dirname + "/../../caf/";
const ALERTA_MIN_FOLIOS = 1500;
let CAF_PATH;

// --- Función para crear payload según producto ---
function crearPayload(producto, folio) {
  return {
    Documento: {
      Encabezado: {
        IdentificacionDTE: {
          TipoDTE: 39, // Boleta electrónica
          Folio: folio,
          FechaEmision: new Date().toISOString().split("T")[0],
          IndicadorServicio: 3,
          IndicadorMontosNetosBoleta: 1,
        },
        Emisor: {
          Rut: `${EMISOR_RUT}-${EMISOR_DV}`,
          RazonSocialBoleta: "INMOBILIARIA E INVERSIONES P Y R S.A.",
          GiroBoleta: "OBRAS MENORES EN CONSTRUCCIÓN",
          DireccionOrigen: "SAN BORJA N1251",
          ComunaOrigen: "ESTACION CENTRAL",
        },
        Receptor: {
          Rut: "66666666-6",
          RazonSocial: "Consumidor final",
          Direccion: "Sin dirección",
          Comuna: "Santiago",
        },
        Totales: {
          MontoNeto: producto.precio,
          IVA: Math.round(producto.precio * 0.19),
          MontoTotal: Math.round(producto.precio * 1.19),
          MontoExento: 0,
        },
      },
      Detalles: [
        {
          IndicadorExento: 0,
          Nombre: producto.nombre,
          Cantidad: 1,
          Precio: producto.precio,
          MontoItem: producto.precio,
        },
      ],
    },
    Certificado: {
      Rut: process.env.CERT_RUT,
      Password: CERT_PASS,
    },
  };
}

// --- Endpoint para solicitar nuevos folios ---
exports.solicitarNuevosFolios = async (req, res) => {
  try {
    const cantidad = req.body.cantidad;

    // Validaciones básicas
    if (cantidad === undefined)
      return res
        .status(400)
        .json({ error: "Debes enviar la cantidad de folios a solicitar." });

    if (typeof cantidad !== "number" || isNaN(cantidad) || cantidad <= 0)
      return res.status(400).json({ error: "Cantidad de folios inválida." });

    if (cantidad < ALERTA_MIN_FOLIOS)
      return res.status(400).json({
        error: `La cantidad de folios solicitados es menor a ${ALERTA_MIN_FOLIOS}. Sugerencia: 500000`,
      });

    const url = `https://servicios.simpleapi.cl/api/folios/get/39/${cantidad}`;
    const data = new FormData();
    data.append(
      "input",
      JSON.stringify({
        RutCertificado: process.env.CERT_RUT,
        Password: CERT_PASS,
        RutEmpresa: `${EMISOR_RUT}-${EMISOR_DV}`,
        Ambiente: 0,
      })
    );
    data.append("files", fs.createReadStream(CERT_PATH));

    const response = await axios.post(url, data, {
      headers: { ...data.getHeaders(), Authorization: API_KEY },
      maxBodyLength: Infinity,
      timeout: 120000,
    });

    if (!response.data)
      return res
        .status(500)
        .json({ error: "No se recibió CAF desde SimpleAPI." });

    // Guardar CAF recibido
    try {
      const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
      const nombreArchivo = `caf_${timestamp}.xml`;
      const rutaArchivo = path.join(CAF_DIRECTORY, nombreArchivo);

      fs.writeFileSync(rutaArchivo, response.data, "utf-8");
      console.log(`CAF guardado correctamente en: ${rutaArchivo}`);

      return res.status(201).json({
        message: "Nuevos folios solicitados correctamente",
        cafGuardadoEn: rutaArchivo,
      });
    } catch (fileErr) {
      console.error("Error guardando CAF:", fileErr.message);
      return res
        .status(500)
        .json({ error: "Error guardando el CAF en el servidor." });
    }
  } catch (err) {
    console.error(
      "Error solicitando nuevos folios:",
      err.response?.data || err.message
    );
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: "Error solicitando nuevos folios: " + err.message });
    }
  }
};

// Funciones auxiliares
// --- Obtener siguiente folio revisando todos los CAF ---

async function obtenerSiguienteFolio() {
  try {
    // --- Obtener último folio CON CONVERSIÓN A NÚMERO ---
    const [rows] = await db.query(`
      SELECT MAX(folio) as ultimo
      FROM boletas
      WHERE ficticia IS NULL OR ficticia = 0
    `);

    // Conversión explícita a número
    const ultimoFolio = Number(rows[0]?.ultimo) || 0;
    const siguienteFolio = ultimoFolio + 1;

    console.log("Debug folios:");
    console.log(
      " - Último folio en BD:",
      rows[0]?.ultimo,
      "(tipo:",
      typeof rows[0]?.ultimo + ")"
    );
    console.log(" - Convertido a número:", ultimoFolio);
    console.log(" - Siguiente folio:", siguienteFolio);

    // --- Leer CAF disponibles ---
    const archivosCAF = fs
      .readdirSync(CAF_DIRECTORY)
      .filter((f) => f.endsWith(".xml"));

    if (!archivosCAF.length) {
      console.log("No hay CAF en la carpeta.");
      return { folioAsignado: null, CAF_PATH: null, totalFoliosRestantes: 0 };
    }

    // --- Mapear CAF con rangos ---
    const cafs = archivosCAF
      .map((archivo) => {
        const ruta = path.join(CAF_DIRECTORY, archivo);
        const cafXml = fs.readFileSync(ruta, "utf-8");
        const rngMatch = cafXml.match(
          /<RNG>\s*<D>(\d+)<\/D>\s*<H>(\d+)<\/H>\s*<\/RNG>/
        );

        if (!rngMatch) return null;

        return {
          archivo,
          ruta,
          desde: parseInt(rngMatch[1].trim(), 10),
          hasta: parseInt(rngMatch[2].trim(), 10),
          total:
            parseInt(rngMatch[2].trim(), 10) -
            parseInt(rngMatch[1].trim(), 10) +
            1,
        };
      })
      .filter(Boolean);

    // --- Ordenar CAF por folio inicial ---
    cafs.sort((a, b) => a.desde - b.desde);

    let CAF_PATH_local = null;
    let cafSeleccionado = null;
    let totalFoliosRestantes = 0;

    // --- Buscar CAF apropiado ---
    for (const caf of cafs) {
      totalFoliosRestantes += caf.total;

      if (siguienteFolio >= caf.desde && siguienteFolio <= caf.hasta) {
        CAF_PATH_local = caf.ruta;
        cafSeleccionado = caf.archivo;
        break;
      }
    }

    if (!CAF_PATH_local) {
      console.log("No hay folios disponibles en los CAF.");
      console.log("Siguiente folio necesario:", siguienteFolio);
      console.log(
        "CAFs disponibles:",
        cafs.map((c) => `${c.archivo}: ${c.desde}-${c.hasta}`)
      );
      return { folioAsignado: null, CAF_PATH: null, totalFoliosRestantes };
    }

    // --- Retornar resultado ---
    console.log(
      `CAF seleccionado: ${cafSeleccionado} | Folio: ${siguienteFolio}`
    );
    CAF_PATH = CAF_PATH_local;
    return {
      folioAsignado: siguienteFolio,
      CAF_PATH: CAF_PATH_local,
      cafSeleccionado,
      totalFoliosRestantes,
    };
    // prueba boleta ficticia
    // return {
    //   folioAsignado: null,
    //   CAF_PATH: CAF_PATH_local,
    //   cafSeleccionado,
    //   totalFoliosRestantes,
    // };
  } catch (error) {
    console.error("Error en obtenerSiguienteFolio:", error);
    return { folioAsignado: null, CAF_PATH: null, totalFoliosRestantes: 0 };
  }
}

// --- Extraer datos de resolución desde CAF ---
function obtenerDatosResolucion() {
  const cafXml = fs.readFileSync(CAF_PATH, "utf-8");
  const faMatch = cafXml.match(/<FA>(.*?)<\/FA>/);
  const idkMatch = cafXml.match(/<IDK>(\d+)<\/IDK>/);

  if (!faMatch || !idkMatch) throw new Error("CAF inválido");

  return {
    FechaResolucion: faMatch[1],
    NumeroResolucion: parseInt(idkMatch[1], 10),
  };
}

// --- Endpoint emitirBoleta ---
exports.emitirBoleta = async (req, res) => {
  const { nombre, precio } = req.body;
  if (!nombre || !precio)
    return res.status(400).json({ error: "Faltan datos del producto" });

  try {
    const { folioAsignado, CAF_PATH, totalFoliosRestantes } =
      await obtenerSiguienteFolio();
    console.log("CAF_PATH:", CAF_PATH);
    console.log("folioAsignado en flujo:", folioAsignado);

    // --- CASO: No hay folio disponible → boleta ficticia ---
    if (!folioAsignado) {
      const folioFicticio = Math.floor(Math.random() * 10000000) + 7000000;
      console.log("No hay folios disponibles. Boleta ficticia:", folioFicticio);

      await db.query(
        `INSERT INTO boletas (folio, producto, precio, fecha, estado_sii, xml_base64, track_id, ficticia)
         VALUES (NULL, ?, ?, NOW(), ?, ?, ?, 1)`,
        [nombre, precio, "FICTICIA", null, null, null]
      );

      return res.status(200).json({
        message:
          "No hay folios disponibles. Se generó una boleta ficticia para pruebas.",
        folio: folioFicticio,
        ficticia: true,
      });
    }

    // --- Boleta real ---
    const producto = { nombre, precio };
    const payload = crearPayload(producto, folioAsignado);
    console.log("Folio Asignado:", folioAsignado);
    console.log("__dirname:", __dirname);
    console.log("CAF_PATH absoluto:", CAF_PATH);
    console.log("Tamaño CERT_PATH:", fs.statSync(CERT_PATH).size);
    console.log("Tamaño CAF_PATH:", fs.statSync(CAF_PATH).size);

    // Generar DTE
    const formGen = new FormData();
    formGen.append("files", fs.createReadStream(CERT_PATH));
    formGen.append("files2", fs.createReadStream(CAF_PATH));
    formGen.append("input", JSON.stringify(payload));

    const responseGen = await axios.post(`${API_URL}/dte/generar`, formGen, {
      headers: { Authorization: API_KEY, ...formGen.getHeaders() },
    });

    const dteXml = responseGen.data;

    // Generar Sobre de Envío
    const { FechaResolucion, NumeroResolucion } = obtenerDatosResolucion();
    const formSobre = new FormData();
    formSobre.append(
      "input",
      JSON.stringify({
        Certificado: { Rut: process.env.CERT_RUT, Password: CERT_PASS },
        Caratula: {
          RutEmisor: `${EMISOR_RUT}-${EMISOR_DV}`,
          RutReceptor: "60803000-K",
          FechaResolucion,
          NumeroResolucion,
        },
      })
    );
    formSobre.append("files", fs.createReadStream(CERT_PATH));
    formSobre.append("files", Buffer.from(dteXml, "utf-8"), {
      filename: `dte_${folioAsignado}.xml`,
    });

    const responseSobre = await axios.post(
      `${API_URL}/envio/generar`,
      formSobre,
      {
        headers: { Authorization: API_KEY, ...formSobre.getHeaders() },
        maxBodyLength: Infinity,
      }
    );

    const sobreXml = responseSobre.data;

    // Enviar al SII
    const formEnvio = new FormData();
    formEnvio.append("files", fs.createReadStream(CERT_PATH));
    formEnvio.append("files2", Buffer.from(sobreXml, "utf-8"), {
      filename: `sobre_${folioAsignado}.xml`,
    });
    formEnvio.append(
      "input",
      JSON.stringify({
        Certificado: { Rut: process.env.CERT_RUT, Password: CERT_PASS },
        Ambiente: 1,
        Tipo: 2,
      })
    );

    const responseEnvio = await axios.post(
      `${API_URL}/envio/enviar`,
      formEnvio,
      {
        headers: { Authorization: API_KEY, ...formEnvio.getHeaders() },
      }
    );

    const trackId = responseEnvio.data?.trackId;

    // Consultar estado
    const formConsulta = new FormData();
    formConsulta.append("files", fs.createReadStream(CERT_PATH));
    formConsulta.append(
      "input",
      JSON.stringify({
        Certificado: { Rut: process.env.CERT_RUT, Password: CERT_PASS },
        RutEmpresa: `${EMISOR_RUT}-${EMISOR_DV}`,
        TrackId: trackId,
        Ambiente: 1,
        ServidorBoletaREST: true,
      })
    );

    const responseConsulta = await axios.post(
      `${API_URL}/consulta/envio`,
      formConsulta,
      {
        headers: { Authorization: API_KEY, ...formConsulta.getHeaders() },
      }
    );

    const estado = responseConsulta.data?.estado;
    const estadosValidos = ["ACE", "EPR", "REC", "SOK", "DOK"];
    const xmlBase64 = Buffer.from(dteXml, "utf-8").toString("base64");

    if (!estadosValidos.includes(estado)) {
      throw new Error(
        `El SII rechazó la boleta. Estado: ${estado || "desconocido"}`
      );
    }

    // Guardar boleta real en DB
    try {
      const [result] = await db.query(
        `INSERT INTO boletas (folio, producto, precio, fecha, estado_sii, xml_base64, track_id, ficticia)
     VALUES (?, ?, ?, NOW(), ?, ?, ?, 0)`,
        [folioAsignado, nombre, precio, estado, xmlBase64, trackId]
      );
      console.log("Boleta guardada en base de datos con folio:", folioAsignado);
    } catch (error) {
      console.error("Error guardando boleta:", error);
    }

    res.status(201).json({
      message: "Boleta generada correctamente",
      folio: folioAsignado,
      alerta:
        totalFoliosRestantes <= ALERTA_MIN_FOLIOS
          ? `Quedan solo ${totalFoliosRestantes} folios disponibles`
          : null,
      ficticia: false,
    });
  } catch (err) {
    console.error("Error en flujo boleta:", err.response?.data || err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
};
