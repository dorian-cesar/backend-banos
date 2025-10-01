const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const db = require("../config/db.config");
const path = require("path");
const nodemailer = require("nodemailer");
require("dotenv").config();

// Configuración SimpleAPI
const API_URL = process.env.SIMPLEAPI_URL;
const API_KEY = process.env.SIMPLEAPI_KEY;
const EMISOR_RUT = process.env.EMISOR_RUT;
const EMISOR_DV = process.env.EMISOR_DV;
const CERT_PATH = __dirname + "/../../certificado/certificado.pfx";
const CERT_PASS = process.env.CERT_PASS;
const CAF_DIRECTORY = __dirname + "/../../caf/";
const ALERTA_MIN_FOLIOS = 100;
let CAF_PATH;

// --- Función para crear payload según producto ---
function crearPayload(producto, folio) {
  const precioBruto = producto.precio; // Precio final al cliente
  const montoNeto = Math.round(precioBruto / 1.19); // monto antes de IVA
  const iva = precioBruto - montoNeto; // IVA calculado

  return {
    Documento: {
      Encabezado: {
        IdentificacionDTE: {
          TipoDTE: 39, // Boleta electrónica
          Folio: folio,
          FechaEmision: new Date().toISOString().split("T")[0],
          IndicadorServicio: 3,
        },
        Emisor: {
          Rut: `${EMISOR_RUT}-${EMISOR_DV}`,
          RazonSocialBoleta: "WIT INNOVACION TECNOLOGICA SPA",
          GiroBoleta:
            "OTRAS ACTIVIDADES DE TECNOLOGÍA DE LA INFORMACIÓN Y DE SERVICIOS INFORMÁTICOS",
          DireccionOrigen: "AVENIDA OBISPO MANUEL UMANA 633",
          ComunaOrigen: "ESTACION CENTRAL",
        },
        Receptor: {
          Rut: "66666666-6", // consumidor final
          RazonSocial: "Consumidor final",
          Direccion: "Sin dirección",
          Comuna: "Santiago",
        },
        Totales: {
          MontoNeto: montoNeto,
          IVA: iva,
          MontoTotal: precioBruto,
          MontoExento: 0,
        },
      },
      Detalles: [
        {
          Nombre: producto.nombre,
          Cantidad: 1,
          Precio: montoNeto,
          MontoItem: montoNeto,
          IndicadorExento: 0,
        },
      ],
    },
    Certificado: {
      Rut: process.env.CERT_RUT,
      Password: process.env.CERT_PASS,
    },
  };
}

// --- Endpoint para obtener información de CAF_DIRECTORY ---
exports.obtenerInfoCAF = (req, res) => {
  try {
    const archivos = fs.readdirSync(CAF_DIRECTORY);
    if (!archivos.length) {
      return res.status(404).json({
        message: "No hay archivos CAF en el directorio.",
        ubicacion: path.resolve(CAF_DIRECTORY),
        totalTamañoBytes: 0,
        archivos: [],
      });
    }
    let tamañoTotal = 0;
    const archivosConInfo = archivos.map((archivo) => {
      const rutaArchivo = path.join(CAF_DIRECTORY, archivo);
      const stats = fs.statSync(rutaArchivo);
      tamañoTotal += stats.size;
      const fechaCreacionLegible = stats.birthtime.toLocaleString("es-CL", {
        timeZone: "America/Santiago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      return {
        nombre: archivo,
        tamañoBytes: stats.size,
        rutaCompleta: rutaArchivo,
        fechaCreacion: fechaCreacionLegible,
      };
    });
    res.status(200).json({
      ubicacion: path.resolve(CAF_DIRECTORY),
      totalTamañoBytes: tamañoTotal,
      archivos: archivosConInfo,
    });
  } catch (error) {
    console.error("Error leyendo CAF_DIRECTORY:", error);
    res
      .status(500)
      .json({ error: "No se pudo leer el directorio CAF: " + error.message });
  }
};

// --- Endpoint consultar folios restantes ---
exports.obtenerFoliosRestantes = async (req, res) => {
  try {
    const { folioAsignado, CAF_PATH, cafSeleccionado, totalFoliosRestantes } =
      await obtenerSiguienteFolio();

    // Si folioAsignado es null, buscamos el último folio usado en la BD
    let ultimoFolio = null;
    if (folioAsignado) {
      ultimoFolio = Number(folioAsignado) - 1;
    } else {
      try {
        const [rows] = await db.query(
          `SELECT folio FROM boletas ORDER BY id DESC LIMIT 1`
        );
        if (rows.length && rows[0].folio != null) {
          ultimoFolio = Number(rows[0].folio);
        } else {
          ultimoFolio = null;
        }
      } catch (dbErr) {
        console.error("Error consultando último folio en BD:", dbErr);
        ultimoFolio = null;
      }
    }

    if (!CAF_PATH) {
      return res.status(404).json({
        message: "No hay CAF disponibles para emitir boletas.",
        ultimoFolio,
        totalFoliosRestantes,
      });
    }

    let resolucion = null;
    try {
      resolucion = obtenerDatosResolucion(CAF_PATH);
    } catch (err) {
      console.warn("No se pudieron obtener datos de resolución:", err.message);
    }

    console.log("Endpoint obtenerFoliosRestantes ejecutado con éxito");
    return res.status(200).json({
      caf: cafSeleccionado,
      ultimoFolio,
      totalFoliosRestantes,
      resolucionCAF: resolucion,
    });
  } catch (error) {
    console.error("Error obteniendo folios restantes:", error);
    res
      .status(500)
      .json({ error: "Error al calcular folios restantes: " + error.message });
  }
};

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
      headers: {
        ...data.getHeaders(),
        Authorization: API_KEY,
      },
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
      err || err.response?.data || err.message
    );
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: "Error solicitando nuevos folios: " + err.message });
    }
  }
};

// Envío de email
async function enviarAlertaCorreo(totalFoliosRestantes) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"Sistema Boletas" <${process.env.SMTP_USER}>`,
      // to: "dwigodski@wit.la, sandoval.jesus2005@gmail.com",
      to: "dwigodski@wit.la",
      subject: "🚨 Alerta: folios disponibles bajos!",
      text: `Quedan solo ${totalFoliosRestantes} folios disponibles en el sistema de boletas de Baño y Duchas en el Terminal.\n Por favor solicita nuevos folios lo antes posible.\n Solicita la obtención de nuevos folios con sus credenciales aquí: https://mantenedor-banios.netlify.app/dashboard/folios\n`,
    });

    console.log("Correo de alerta de folios enviado:", info.messageId);
  } catch (err) {
    console.error("Error al enviar correo de alerta:", err);
  }
}

async function enviarAlertaCorreoSimpleAPI(peticionesRestantes) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"Sistema Boletas" <${process.env.SMTP_USER}>`,
      to: "dwigodski@wit.la",
      subject: "🚨 Alerta: peticiones disponibles bajas en SimpleAPI",
      text: `Quedan solo ${peticionesRestantes} peticiones disponibles en tu suscripción de SimpleAPI.\nPor favor verifica tu límite y solicita renovación si es necesario.`,
    });

    console.log("Correo de alerta de peticiones enviado:", info.messageId);
  } catch (err) {
    console.error("Error al enviar correo de alerta:", err);
  }
}

// --- Obtener siguiente folio revisando todos los CAF ---
async function obtenerSiguienteFolio() {
  try {
    // --- Obtener último folio CON CONVERSIÓN A NÚMERO ---
    // const [rows] = await db.query(
    //   `SELECT MAX(folio) as ultimo FROM boletas WHERE (ficticia IS NULL OR ficticia = 0) AND (estado_sii IS NULL OR estado_sii != 'RSC') AND folio NOT REGEXP '-[0-9]+$'`
    // );
    const [rows] = await db.query(
      `SELECT MAX(folio) as ultimo FROM boletas WHERE (ficticia IS NULL OR ficticia = 0) AND folio NOT REGEXP '-[0-9]+$'`
    );
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

    // --- Buscar CAF apropiado y sumar folios restantes ---
    for (const caf of cafs) {
      if (caf.hasta > ultimoFolio) {
        const desdeValido = Math.max(caf.desde, ultimoFolio + 1);
        totalFoliosRestantes += caf.hasta - desdeValido + 1;
      }

      if (siguienteFolio >= caf.desde && siguienteFolio <= caf.hasta) {
        CAF_PATH_local = caf.ruta;
        cafSeleccionado = caf.archivo;
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
      `CAF seleccionado: ${cafSeleccionado} | Folio: ${siguienteFolio} | Folios Restantes: ${totalFoliosRestantes}`
    );
    CAF_PATH = CAF_PATH_local;

    // FLUJO PARA BOLETA ELECTRÓNICA (SIMPLE API)
    return {
      folioAsignado: siguienteFolio,
      CAF_PATH: CAF_PATH_local,
      cafSeleccionado,
      totalFoliosRestantes,
    };

    // FLUJO PARA BOLETA FICTICIA
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
function obtenerDatosResolucion(cafPath) {
  const cafXml = fs.readFileSync(cafPath, "utf-8");
  const faMatch = cafXml.match(/<FA>(.*?)<\/FA>/);
  const idkMatch = cafXml.match(/<IDK>(\d+)<\/IDK>/);

  if (!faMatch || !idkMatch) {
    throw new Error(`CAF inválido o incompleto en: ${cafPath}`);
  }

  return {
    FechaResolucion: faMatch[1],
    NumeroResolucion: parseInt(idkMatch[1], 10),
  };
}

function obtenerFechaHoraChile() {
  const opciones = {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };

  const fechaChile = new Intl.DateTimeFormat("es-CL", opciones).format(
    new Date()
  );
  const [fecha, hora] = fechaChile.split(", ");
  const [dia, mes, anio] = fecha.split("-");
  return `${anio}-${mes}-${dia} ${hora}`;
}

const fechaChile = obtenerFechaHoraChile();

// --- Endpoint emitirBoleta con flujo principal ---
exports.emitirBoleta = async (req, res) => {
  const { nombre, precio } = req.body;
  if (!nombre || !precio)
    return res.status(400).json({ error: "Faltan datos del producto" });

  try {
    const { folioAsignado, CAF_PATH, totalFoliosRestantes } =
      await obtenerSiguienteFolio();
    console.log("CAF_PATH:", CAF_PATH);

    // --- CASO: No hay folio disponible → boleta ficticia ---
    if (!folioAsignado) {
      const folioFicticio = Math.floor(Math.random() * 90) + 10; // 2 dígitos
      console.log("No hay folios disponibles. Boleta ficticia:", folioFicticio);

      await db.query(
        `INSERT INTO boletas (folio, producto, precio, fecha, estado_sii, xml_base64, track_id, ficticia, alerta) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, FALSE)`,
        [folioFicticio, nombre, precio, fechaChile, "FICTICIA", null, null]
      );

      return res.status(201).json({
        message: "No hay folios disponibles. Se generó una boleta ficticia.",
        folio: folioFicticio,
        ficticia: true,
      });
    }

    // --- Boleta real ---
    console.log("Folio Asignado:", folioAsignado);

    // --- RESPUESTA RÁPIDA AL FRONT ---
    res.status(201).json({
      message: "Folio asignado correctamente",
      folio: folioAsignado,
      ficticia: false,
    });

    // --- TODO LO DEMÁS ASÍNCRONO ---
    (async () => {
      try {
        const producto = { nombre, precio };
        const payload = crearPayload(producto, folioAsignado);

        console.log("__dirname:", __dirname);
        console.log("CAF_PATH absoluto:", CAF_PATH);
        console.log("Tamaño CERT_PATH:", fs.statSync(CERT_PATH).size);
        console.log("Tamaño CAF_PATH:", fs.statSync(CAF_PATH).size);

        // Generar DTE
        const formGen = new FormData();
        formGen.append("files", fs.createReadStream(CERT_PATH));
        formGen.append("files2", fs.createReadStream(CAF_PATH));
        formGen.append("input", JSON.stringify(payload));

        const responseGen = await axios.post(
          `${API_URL}/dte/generar`,
          formGen,
          {
            headers: { Authorization: API_KEY, ...formGen.getHeaders() },
          }
        );
        const dteXml = responseGen.data;

        console.log("XML generado (primeras 500 chars):");
        console.log(dteXml.substring(0, 500));

        // Generar Sobre
        const { FechaResolucion, NumeroResolucion } =
          obtenerDatosResolucion(CAF_PATH);
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
            Ambiente: 0,
            Tipo: 2,
          })
        );

        console.log("Form envio:", formEnvio);

        const responseEnvio = await axios.post(
          `${API_URL}/envio/enviar`,
          formEnvio,
          {
            headers: { Authorization: API_KEY, ...formEnvio.getHeaders() },
          }
        );
        const trackId = responseEnvio.data?.trackId;
        console.log("TrackId recibido:", trackId);

        // Consultar estado
        const formConsulta = new FormData();
        formConsulta.append("files", fs.createReadStream(CERT_PATH));
        formConsulta.append(
          "input",
          JSON.stringify({
            Certificado: { Rut: process.env.CERT_RUT, Password: CERT_PASS },
            RutEmpresa: `${EMISOR_RUT}-${EMISOR_DV}`,
            TrackId: trackId,
            Ambiente: 0,
            ServidorBoletaREST: 0,
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
        console.log("Response Estado SII:", responseConsulta.data);
        const estadosValidos = ["ACE", "EPR", "REC", "SOK", "DOK"];
        const xmlBase64 = Buffer.from(dteXml, "utf-8").toString("base64");

        // Ajustar folio si estado es RSC
        let folioParaGuardar = folioAsignado;
        if (estado === "RSC") {
          folioParaGuardar = `${folioAsignado}-${Math.floor(
            Math.random() * 900000 + 100000
          )}`;
        }

        // Evaluar alerta
        const [ultimaBoleta] = await db.query(
          `SELECT folio, alerta FROM boletas ORDER BY id DESC LIMIT 1`
        );
        const alertaAnterior = ultimaBoleta[0]?.alerta;
        let alertaActual = false;

        if (totalFoliosRestantes < ALERTA_MIN_FOLIOS) {
          if (!alertaAnterior) {
            console.log("Enviando alerta de folios bajos...");
            await enviarAlertaCorreo(totalFoliosRestantes);
            alertaActual = true;
          } else {
            console.log(
              "Alerta ya enviada en la boleta anterior. No se envía mail nuevamente."
            );
            alertaActual = true;
          }
        } else {
          console.log("Folios suficientes, no se envía mail de alerta");
          alertaActual = false;
        }

        // Guardar boleta en DB
        await db.query(
          `INSERT INTO boletas (folio, producto, precio, fecha, estado_sii, xml_base64, track_id, ficticia, alerta)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
          [
            folioParaGuardar,
            nombre,
            precio,
            fechaChile,
            estado,
            xmlBase64,
            trackId,
            alertaActual,
          ]
        );

        console.log(
          "Boleta guardada en base de datos con folio:",
          folioParaGuardar,
          "| alerta:",
          alertaActual
        );

        if (!estadosValidos.includes(estado)) {
          console.log(
            `El SII rechazó la boleta. Estado: ${estado || "desconocido"}`
          );
        }
      } catch (err) {
        console.error(
          "Error en flujo de boleta:",
          err.response?.data || err.message
        );
      }
    })();
  } catch (err) {
    console.error("Error al asignar folio:", err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
};

// ----- Endpoint: emitir un lote de boletas con 1 solo folio en el SII -----
exports.emitirLoteBoletas = async (req, res) => {
  let { nombre, precio, cantidad, monto_total } = req.body;

  precio = Number(precio);
  cantidad = Number(cantidad);
  monto_total = Number(monto_total);

  if (!nombre || isNaN(precio) || isNaN(cantidad) || isNaN(monto_total)) {
    return res
      .status(400)
      .json({ error: "Faltan datos válidos numéricos para generar el lote" });
  }

  if (precio * cantidad !== monto_total) {
    return res.status(400).json({
      error: "El monto_total no coincide con precio * cantidad",
    });
  }

  try {
    const { folioAsignado, CAF_PATH, totalFoliosRestantes } =
      await obtenerSiguienteFolio();

    // --- CASO: No hay folio disponible → generar lote ficticio ---
    if (!folioAsignado) {
      const folioFicticioPadre = Math.floor(Math.random() * 90) + 10;

      for (let i = 0; i < cantidad; i++) {
        await db.query(
          `INSERT INTO boletas 
            (folio, folio_padre, producto, precio, fecha, estado_sii, xml_base64, track_id, ficticia, alerta, monto_lote, cantidad_lote) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, FALSE, ?, ?)`,
          [
            `${folioFicticioPadre}-${i + 1}`,
            folioFicticioPadre,
            nombre,
            precio,
            fechaChile,
            "FICTICIA",
            null,
            null,
            monto_total,
            cantidad,
          ]
        );
      }

      return res.status(201).json({
        message: "No hay folios disponibles. Se generó un lote ficticio.",
        folio_padre: folioFicticioPadre,
        cantidad,
        monto_total,
        ficticia: true,
      });
    }

    // --- RESPUESTA RÁPIDA AL FRONT ---
    res.status(201).json({
      message: "Folio asignado correctamente",
      folio_padre: folioAsignado,
      cantidad,
      monto_total,
      ficticia: false,
    });

    // --- TODO LO DEMÁS ASÍNCRONO ---
    (async () => {
      try {
        const productoLote = { nombre, precio: monto_total };
        const payload = crearPayload(productoLote, folioAsignado);

        // Generar DTE
        const formGen = new FormData();
        formGen.append("files", fs.createReadStream(CERT_PATH));
        formGen.append("files2", fs.createReadStream(CAF_PATH));
        formGen.append("input", JSON.stringify(payload));

        const responseGen = await axios.post(
          `${API_URL}/dte/generar`,
          formGen,
          {
            headers: { Authorization: API_KEY, ...formGen.getHeaders() },
          }
        );
        const dteXml = responseGen.data;

        // Generar Sobre
        const { FechaResolucion, NumeroResolucion } =
          obtenerDatosResolucion(CAF_PATH);
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
          { headers: { Authorization: API_KEY, ...formSobre.getHeaders() } }
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
            Ambiente: 0,
            Tipo: 2,
          })
        );

        const responseEnvio = await axios.post(
          `${API_URL}/envio/enviar`,
          formEnvio,
          { headers: { Authorization: API_KEY, ...formEnvio.getHeaders() } }
        );
        const trackId = responseEnvio.data?.trackId;

        // Consultar estado en SII
        const formConsulta = new FormData();
        formConsulta.append("files", fs.createReadStream(CERT_PATH));
        formConsulta.append(
          "input",
          JSON.stringify({
            Certificado: { Rut: process.env.CERT_RUT, Password: CERT_PASS },
            RutEmpresa: `${EMISOR_RUT}-${EMISOR_DV}`,
            TrackId: trackId,
            Ambiente: 0,
            ServidorBoletaREST: 1,
          })
        );

        const responseConsulta = await axios.post(
          `${API_URL}/consulta/envio`,
          formConsulta,
          { headers: { Authorization: API_KEY, ...formConsulta.getHeaders() } }
        );
        const estado = responseConsulta.data?.estado;
        const estadosValidos = ["ACE", "EPR", "REC", "SOK", "DOK"];
        const xmlBase64 = Buffer.from(dteXml, "utf-8").toString("base64");

        // Verificar alerta por folios bajos
        const [ultimaBoleta] = await db.query(
          `SELECT alerta FROM boletas ORDER BY id DESC LIMIT 1`
        );
        const alertaAnterior = ultimaBoleta[0]?.alerta;
        let alertaActual = false;

        if (totalFoliosRestantes < ALERTA_MIN_FOLIOS) {
          if (!alertaAnterior) {
            console.log("Enviando alerta de folios bajos...");
            await enviarAlertaCorreo(totalFoliosRestantes);
            alertaActual = true;
          } else {
            alertaActual = true;
          }
        }

        // Guardar N boletas hijas
        for (let i = 0; i < cantidad; i++) {
          await db.query(
            `INSERT INTO boletas 
              (folio, folio_padre, producto, precio, fecha, estado_sii, xml_base64, track_id, ficticia, alerta, monto_lote, cantidad_lote) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
            [
              `${folioAsignado}-${i + 1}`,
              folioAsignado,
              nombre,
              precio,
              fechaChile,
              estado,
              xmlBase64,
              trackId,
              alertaActual,
              monto_total,
              cantidad,
            ]
          );
        }
      } catch (err) {
        console.error(
          "Error en flujo del lote:",
          err.response?.data || err.message
        );
      }
    })();
  } catch (err) {
    console.error("Error en flujo lote:", err.response?.data || err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
};

// --- Endpoint para consultar el status de la suscripción y enviar email de alerta ---
exports.obtenerStatusSuscripcion = async (req, res) => {
  try {
    const servicios = await axios
      .get("https://api.simpleapi.cl/api/v1/suscripcion/status", {
        headers: { Authorization: API_KEY },
        timeout: 20000,
      })
      .then((r) => r.data);

    if (!Array.isArray(servicios)) {
      console.error("Respuesta de la API inválida:", servicios);
      return res.status(500).json({
        error: "No se pudo obtener el status de la suscripción",
        detalle: "Respuesta de la API inválida",
      });
    }

    const simpleAPI = servicios.find((s) => s.servicio === "SimpleAPI");
    let emailEnviado = false;
    let porcentajeRestante = null;
    let peticionesRestantes = null;

    if (simpleAPI) {
      const restante = simpleAPI.maximo - simpleAPI.uso;
      peticionesRestantes = restante;
      porcentajeRestante = (restante / simpleAPI.maximo) * 100;

      console.log(
        `SimpleAPI restante: ${restante}, porcentaje: ${porcentajeRestante.toFixed(
          2
        )}%`
      );

      if (porcentajeRestante <= 15) {
        console.log("Alerta: Quedan menos del 15% de peticiones en SimpleAPI");
        await enviarAlertaCorreoSimpleAPI(restante);
        emailEnviado = true;
      }
    }

    return res.status(200).json({
      message: "Status de suscripción obtenido correctamente",
      data: simpleAPI,
      peticionesRestantes,
      porcentajeRestante:
        porcentajeRestante !== null
          ? `${porcentajeRestante.toFixed(2)}%`
          : null,
      emailAlertaEnviado: emailEnviado,
    });
  } catch (error) {
    console.error(
      "Error al consultar status de suscripción:",
      error.response?.data || error.message
    );
    return res.status(500).json({
      error: "No se pudo obtener el status de la suscripción",
      detalle: error.response?.data || error.message,
    });
  }
};

exports.borrarTodasLasBoletas = async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM boletas");

    res.status(200).json({
      message: `Se eliminaron ${result.affectedRows} boletas`,
    });
  } catch (error) {
    console.error("Error al borrar todas las boletas:", error);
    res.status(500).json({ error: "Error al borrar todas las boletas" });
  }
};
