const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
require("dotenv").config();

// Configuración desde variables de entorno
const API_USERNAME = process.env.SIMPLEAPI_USERNAME;
const API_PASSWORD = process.env.SIMPLEAPI_PASSWORD;
const EMISOR_RUT = process.env.EMISOR_RUT;
const EMISOR_DV = process.env.EMISOR_DV;
const CERT_PATH = __dirname + "./certificado/certificado.pfx";
const CERT_PASS = process.env.CERT_PASS;

async function consultarFoliosBoleta() {
  try {
    // Preparar datos
    const data = new FormData();
    const rutEmpresa = `${EMISOR_RUT}${EMISOR_DV}`.replace(/[\.\-]/g, "");

    const inputJson = {
      RutCertificado: rutEmpresa,
      Password: CERT_PASS,
      RutEmpresa: rutEmpresa,
      Ambiente: 1, // 0 para certificación
    };

    data.append("input", JSON.stringify(inputJson));
    data.append("files", fs.createReadStream(CERT_PATH));

    // Configurar request
    const config = {
      method: "post",
      url: "https://servicios.simpleapi.cl/api/folios/get/39/",
      headers: {
        ...data.getHeaders(),
        Authorization: `Basic ${Buffer.from(
          `${API_USERNAME}:${API_PASSWORD}`
        ).toString("base64")}`,
      },
      data: data,
      timeout: 90000,
    };

    // Ejecutar consulta
    console.log("Consultando folios disponibles para boletas electrónicas...");
    const response = await axios(config);
    const folios = parseInt(response.data);

    console.log(`Folios disponibles: ${folios}`);
    return folios;
  } catch (error) {
    console.error("Error al consultar folios:");

    if (error.response) {
      console.error(`Código: ${error.response.status}`);
      console.error(`Respuesta: ${JSON.stringify(error.response.data)}`);
    } else if (error.code === "ENOENT") {
      console.error("No se encuentra el archivo del certificado");
    } else {
      console.error(error.message);
    }

    throw error;
  }
}

// Ejecutar directamente si se llama desde la línea de comandos
if (require.main === module) {
  consultarFoliosBoleta().catch(() => process.exit(1));
}

module.exports = consultarFoliosBoleta;
