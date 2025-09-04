const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
require("dotenv").config();

// Configuración SimpleAPI
const API_URL = process.env.SIMPLEAPI_URL;
const EMISOR_RUT = process.env.EMISOR_RUT;
const EMISOR_DV = process.env.EMISOR_DV;
const CERT_PATH = "./certificado/certificado.pfx";
const CERT_PASS = process.env.CERT_PASS;

// Usuario y contraseña de Basic Auth
const BASIC_USER = "Diego Wigodski"
const BASIC_PASS = "witla222"

// --- Consultar folios disponibles ---
async function consultarFolios() {
  try {
    const url = `https://servicios.simpleapi.cl/api/folios/get/39/`;

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

    const authHeader =
      "Basic " + Buffer.from(`${BASIC_USER}:${BASIC_PASS}`).toString("base64");

    const response = await axios.post(url, data, {
      maxBodyLength: Infinity,
      headers: {
        ...data.getHeaders(),
        Authorization: authHeader,
      },
      timeout: 120000, // esperar hasta 2 minutos
    });

    console.log("Folios disponibles:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Error consultando folios:",
      error.response?.data || error.message
    );
    throw error;
  }
}

consultarFolios();
