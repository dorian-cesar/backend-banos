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
const ALERTA_MIN_FOLIOS = 15000;
let CAF_PATH;
let ultimaAlertaSimpleAPI = 0; // timestamp (ms)
const COOLDOWN_ALERTA_SIMPLE_API = 60 * 60 * 2000; // 2 horas

// --- Función para crear payload según producto ---
function crearPayload(producto, folio, cantidad = 1) {
  const precioUnitario = producto.precio;
  const precioTotal = precioUnitario * cantidad;
  const montoNeto = Math.round(precioTotal / 1.19);
  const iva = precioTotal - montoNeto;

  return {
    Documento: {
      Encabezado: {
        IdentificacionDTE: {
          TipoDTE: 39,
          Folio: folio,
          FechaEmision: new Date().toISOString().split("T")[0],
          IndicadorServicio: 3,
        },
        Emisor: {
          Rut: `${EMISOR_RUT}-${EMISOR_DV}`,
          RazonSocialBoleta: "INMOBILIARIA E INVERSIONES P Y R S.A.",
          GiroBoleta: "OBRAS MENORES EN CONSTRUCCION",
          DireccionOrigen: "SAN BORJA N1251",
          ComunaOrigen: "ESTACION CENTRAL",
        },
        Receptor: {
          Rut: "66666666-6",
          RazonSocial: "Consumidor final",
          Direccion: "Sin direccion",
          Comuna: "Santiago",
        },
        Totales: {
          MontoNeto: montoNeto,
          IVA: iva,
          MontoTotal: precioTotal,
        },
      },
      Detalles: [
        {
          Nombre: producto.nombre,
          Cantidad: cantidad,
          Precio: precioUnitario,
          MontoItem: precioTotal,
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
        Ambiente: 1,
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
      // to: "dwigodski@wit.la, epaz@wit.la, dgonzalez@wit.la",
      to: "dwigodski@wit.la, dgonzalez@wit.la",
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
      // to: "dwigodski@wit.la, epaz@wit.la, dgonzalez@wit.la",
      to: "dwigodski@wit.la, dgonzalez@wit.la",
      subject: "🚨 Alerta: peticiones disponibles bajas en SimpleAPI",
      text: `Quedan solo ${peticionesRestantes} peticiones disponibles en tu suscripción de SimpleAPI.\nPor favor verifica tu límite y solicita renovación si es necesario.`,
    });

    console.log("Correo de alerta de peticiones enviado:", info.messageId);
  } catch (err) {
    console.error("Error al enviar correo de alerta:", err);
  }
}

// Envío de email
// async function enviarAlertaCorreo(totalFoliosRestantes) {
//   try {
//     const transporter = nodemailer.createTransport({
//       host: process.env.SMTP_HOST,
//       port: process.env.SMTP_PORT,
//       secure: true, // usar SSL
//       auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS,
//       },
//     });

//     const info = await transporter.sendMail({
//       from: `"Sistema Boletas" <dgonzalez@wit.la>`,
//       // to: "dwigodski@wit.la, dgonzalez@wit.la",
//       to: "dgonzalez@wit.la",
//       subject: "🚨 Alerta: folios disponibles bajos!",
//       text: `Quedan solo ${totalFoliosRestantes} folios disponibles en el sistema de boletas de Baño y Duchas en el Terminal.

//       Por favor solicita nuevos folios lo antes posible.
//       Solicita la obtención de nuevos folios aquí:
//       https://mantenedor-banios.netlify.app/dashboard/folios`,
//     });

//     console.log("Correo de alerta de folios enviado:", info.messageId);
//   } catch (err) {
//     console.error("Error al enviar correo de alerta:", err);
//   }
// }

// async function enviarAlertaCorreoSimpleAPI(peticionesRestantes) {
//   try {
//     const transporter = nodemailer.createTransport({
//       host: process.env.SMTP_HOST,
//       port: process.env.SMTP_PORT,
//       secure: true,
//       auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS,
//       },
//     });

//     const info = await transporter.sendMail({
//       from: `"Sistema Boletas" <dgonzalez@wit.la>`,
//       // to: "dwigodski@wit.la, dgonzalez@wit.la",
//       to: "dgonzalez@wit.la",
//       subject: "🚨 Alerta: peticiones disponibles bajas en SimpleAPI",
//       text: `Quedan solo ${peticionesRestantes} peticiones disponibles en tu suscripción de SimpleAPI.

//       Por favor verifica tu límite y solicita renovación si es necesario.`,
//     });

//     console.log("Correo de alerta de peticiones enviado:", info.messageId);
//   } catch (err) {
//     console.error("Error al enviar correo de alerta:", err);
//   }
// }

// --- Obtener siguiente folio revisando todos los CAF ---
async function obtenerSiguienteFolio() {
  try {
    // --- Obtener último folio CON CONVERSIÓN A NÚMERO ---
    // const [rows] = await db.query(
    //   `SELECT MAX(folio) as ultimo FROM boletas WHERE (ficticia IS NULL OR ficticia = 0) AND (estado_sii IS NULL OR estado_sii != 'RSC') AND folio NOT REGEXP '-[0-9]+$'`
    // );
    const [rows] = await db.query(`
      SELECT MAX(CAST(SUBSTRING_INDEX(folio, '-', 1) AS UNSIGNED)) AS ultimo
      FROM boletas
      WHERE (ficticia IS NULL OR ficticia = 0)
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

// const fechaChile = obtenerFechaHoraChile();

// --- Endpoint emitirBoleta con flujo principal ---
exports.emitirBoleta = async (req, res) => {
  const { nombre, precio } = req.body;

  nombre = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/Ñ/g, "N")
    .toLowerCase();

  if (!nombre || !precio)
    return res.status(400).json({ error: "Faltan datos del producto" });

  try {
    const { folioAsignado, CAF_PATH, totalFoliosRestantes } =
      await obtenerSiguienteFolio();
    console.log("CAF_PATH:", CAF_PATH);

    // --- CASO: No hay folio disponible → boleta ficticia ---
    if (!folioAsignado) {
      // Generar folio ficticio con formato ###-####
      const folioFicticio = await generarFolioFicticioUnico(db);
      const fechaChile = obtenerFechaHoraChile();
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

        // console.log("XML generado (primeras 500 chars):");
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
            Ambiente: 1,
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
        // const formConsulta = new FormData();
        // formConsulta.append("files", fs.createReadStream(CERT_PATH));
        // formConsulta.append(
        //   "input",
        //   JSON.stringify({
        //     Certificado: { Rut: process.env.CERT_RUT, Password: CERT_PASS },
        //     RutEmpresa: `${EMISOR_RUT}-${EMISOR_DV}`,
        //     TrackId: trackId,
        //     Ambiente: 1,
        //     ServidorBoletaREST: 1,
        //   })
        // );

        // const responseConsulta = await axios.post(
        //   `${API_URL}/consulta/envio`,
        //   formConsulta,
        //   {
        //     headers: { Authorization: API_KEY, ...formConsulta.getHeaders() },
        //   }
        // );
        // const estado = responseConsulta.data?.estado;
        // console.log("Response Estado SII:", responseConsulta.data);
        // const estadosValidos = ["ACE", "EPR", "REC", "SOK", "DOK"];
        const xmlBase64 = Buffer.from(dteXml, "utf-8").toString("base64");
        const estado = "PEND";

        // Ajustar folio si estado es RSC
        let folioParaGuardar = folioAsignado;
        // if (estado === "RSC") {
        //   folioParaGuardar = `${folioAsignado}-${Math.floor(
        //     Math.random() * 900000 + 100000
        //   )}`;
        // }

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

        const fechaChile = obtenerFechaHoraChile();

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

        // if (!estadosValidos.includes(estado)) {
        //   console.log(
        //     `El SII rechazó la boleta. Estado: ${estado || "desconocido"}`
        //   );
        // }
      } catch (err) {
        console.error(
          "Error en flujo de boleta:",
          err.response?.data || err.message
        );
      }
    })();
  } catch (err) {
    console.error(
      "Error en flujo de boleta:",
      err.response?.data || err.message
    );

    // Detectar si el error proviene de SimpleAPI (por límite de peticiones)
    const mensajeError = err.response?.data?.error || err.message;
    const isSimpleApiLimit =
      err.response?.status === 401
        ? mensajeError?.toLowerCase().includes("alcanzado") ||
          mensajeError?.toLowerCase().includes("consultas")
        : err.code === "ECONNRESET" ||
          err.code === "ETIMEDOUT" ||
          err.code === "ECONNREFUSED" ||
          err.code === "EAI_AGAIN" ||
          (err.response &&
            (err.response.status >= 429 || err.response.status >= 500));

    try {
      // Generar boleta ficticia para no perder el registro
      const folioFicticio = await generarFolioFicticioUnico(db);
      const fechaChile = obtenerFechaHoraChile();

      await db.query(
        `INSERT INTO boletas (folio, producto, precio, fecha, estado_sii, xml_base64, track_id, ficticia, alerta)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, FALSE)`,
        [
          folioFicticio,
          nombre,
          precio,
          fechaChile,
          "FICTICIA_ERROR_API",
          null,
          null,
        ]
      );

      console.log(
        "Boleta ficticia creada por error en SimpleAPI:",
        folioFicticio
      );
    } catch (dbErr) {
      console.error("Error al registrar boleta ficticia:", dbErr.message);
    }

    // Enviar notificación si es por límite de peticiones
    if (isSimpleApiLimit) {
      const ahora = Date.now();

      if (ahora - ultimaAlertaSimpleAPI > COOLDOWN_ALERTA_SIMPLE_API) {
        console.log(
          "Enviando correo de alerta: límite de peticiones alcanzado..."
        );
        // await enviarAlertaCorreoSimpleAPI(0);
        ultimaAlertaSimpleAPI = ahora;
      } else {
        console.log(
          "Alerta de SimpleAPI ya enviada recientemente. No se envía nuevo correo."
        );
      }
    }
  }
};

// ----- Endpoint: emitir un lote de boletas (solo un folio real por lote) -----
exports.emitirLoteBoletas = async (req, res) => {
  let { nombre, precio, cantidad, monto_total } = req.body;

  nombre = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/Ñ/g, "N")
    .toLowerCase();

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
    const archivosCAF = fs
      .readdirSync(CAF_DIRECTORY)
      .filter((f) => f.endsWith(".xml"));

    const fechaChile = obtenerFechaHoraChile();

    // Si NO hay CAFs → folio ficticio
    if (!archivosCAF.length) {
      const folioLote = await generarFolioFicticioUnico(db);

      // Como no hay CAF, generamos y guardamos boleta ficticia de inmediato
      await db.query(
        `INSERT INTO boletas 
          (folio, producto, precio, fecha, estado_sii, xml_base64, track_id, ficticia, alerta, monto_lote, cantidad_lote)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, FALSE, ?, ?)`,
        [
          folioLote,
          `${nombre} (LOTE)`,
          monto_total,
          fechaChile,
          "FICTICIA",
          null,
          null,
          monto_total,
          cantidad,
        ]
      );

      return res.status(201).json({
        message: "No hay CAF disponibles. Se generó lote ficticio.",
        folio: folioLote,
        ficticia: true,
      });
    }

    // Hay CAF disponible → buscamos rango correcto
    const cafs = archivosCAF
      .map((archivo) => {
        const ruta = path.join(CAF_DIRECTORY, archivo);
        const cafXml = fs.readFileSync(ruta, "utf-8");
        const rngMatch = cafXml.match(
          /<RNG>\s*<D>(\d+)<\/D>\s*<H>(\d+)<\/H>\s*<\/RNG>/
        );
        if (!rngMatch) return null;
        return {
          ruta,
          desde: parseInt(rngMatch[1], 10),
          hasta: parseInt(rngMatch[2], 10),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.desde - b.desde);

    const [rows] = await db.query(
      "SELECT MAX(CAST(SUBSTRING_INDEX(folio, '-', 1) AS UNSIGNED)) AS ultimo FROM boletas WHERE (ficticia IS NULL OR ficticia = 0)"
    );

    let siguienteFolio = Number(rows[0]?.ultimo) + 1 || 1;
    let cafActual = cafs.find(
      (c) => siguienteFolio >= c.desde && siguienteFolio <= c.hasta
    );

    // Si no hay CAF que cubra el folio → folio ficticio
    let folioLote, ficticia;
    if (!cafActual) {
      folioLote = await generarFolioFicticioUnico(db);
      ficticia = true;
    } else {
      folioLote = siguienteFolio;
      ficticia = false;
    }

    // Flujo asíncrono principal
    (async () => {
      try {
        let xmlBase64 = null;
        let trackId = null;
        let estado = ficticia ? "FICTICIA" : "PEND";

        if (!ficticia) {
          CAF_PATH = cafActual.ruta;
          const payload = crearPayload(
            { nombre, precio: monto_total },
            folioLote
          );

          // Generar DTE XML
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
          const { FechaResolucion, NumeroResolucion } =
            obtenerDatosResolucion(CAF_PATH);

          // Generar sobre
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
            filename: `dte_${folioLote}.xml`,
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
            filename: `sobre_${folioLote}.xml`,
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

          trackId = responseEnvio.data?.trackId;

          // Consultar estado en SII
          // const formConsulta = new FormData();
          // formConsulta.append("files", fs.createReadStream(CERT_PATH));
          // formConsulta.append(
          //   "input",
          //   JSON.stringify({
          //     Certificado: { Rut: process.env.CERT_RUT, Password: CERT_PASS },
          //     RutEmpresa: `${EMISOR_RUT}-${EMISOR_DV}`,
          //     TrackId: trackId,
          //     Ambiente: 1,
          //     ServidorBoletaREST: 1,
          //   })
          // );

          // const responseConsulta = await axios.post(
          //   `${API_URL}/consulta/envio`,
          //   formConsulta,
          //   {
          //     headers: { Authorization: API_KEY, ...formConsulta.getHeaders() },
          //   }
          // );

          // estado = responseConsulta.data?.estado || "PEND";
          xmlBase64 = Buffer.from(sobreXml, "utf-8").toString("base64");
        }

        await db.query(
          `INSERT INTO boletas 
            (folio, producto, precio, fecha, estado_sii, xml_base64, track_id, ficticia, alerta, monto_lote, cantidad_lote)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?, ?)`,
          [
            folioLote,
            `${nombre} (LOTE)`,
            monto_total,
            fechaChile,
            estado,
            xmlBase64,
            trackId,
            ficticia ? 1 : 0,
            monto_total,
            cantidad,
          ]
        );

        console.log(
          `Lote ${folioLote} insertado correctamente (estado: ${estado}, ficticia: ${ficticia})`
        );
      } catch (err) {
        console.error("Error en envío del lote:", err.message);
      }
    })();

    // Responder rápido al cliente
    res.status(201).json({
      message: ficticia
        ? "Lote ficticio iniciado (sin CAF disponible)"
        : "Lote real iniciado",
      folio: folioLote,
      ficticia,
    });
  } catch (err) {
    console.error("Error al procesar lote:", err.message);
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

      // if (porcentajeRestante <= 15) {
      if (porcentajeRestante <= 95) {
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

async function generarFolioFicticioUnico(db) {
  let folio;
  let existe = true;

  while (existe) {
    const base = Math.floor(Math.random() * 900) + 100; // 3 dígitos
    const sufijo = Math.floor(Math.random() * 9000) + 1000; // 4 dígitos
    folio = `${base}-${sufijo}`;

    // Verificar en la base si ya existe ese folio
    const [rows] = await db.query(
      "SELECT id FROM boletas WHERE folio = ? LIMIT 1",
      [folio]
    );
    existe = rows.length > 0;
  }

  return folio;
}

// exports.borrarTodasLasBoletas = async (req, res) => {
//   try {
//     const [result] = await db.query("DELETE FROM boletas");

//     res.status(200).json({
//       message: `Se eliminaron ${result.affectedRows} boletas`,
//     });
//   } catch (error) {
//     console.error("Error al borrar todas las boletas:", error);
//     res.status(500).json({ error: "Error al borrar todas las boletas" });
//   }
// };
