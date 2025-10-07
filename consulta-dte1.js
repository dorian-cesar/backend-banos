const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
require("dotenv").config();

const API_URL = process.env.SIMPLEAPI_URL;
const API_KEY = process.env.SIMPLEAPI_KEY;
const CERT_PATH = __dirname + "/certificado/certificado.pfx";
const CERT_PASS = process.env.CERT_PASS;
const EMISOR_RUT = process.env.EMISOR_RUT;
const EMISOR_DV = process.env.EMISOR_DV;

/**
 * Consulta el estado de un DTE por track_id
 * @param {string} trackId
 * @returns {Promise<string>} estado del DTE
 */
async function consultarEstadoDTE(trackId) {
  try {
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

    const response = await axios.post(
      `${API_URL}/consulta/envio`,
      formConsulta,
      {
        headers: { Authorization: API_KEY, ...formConsulta.getHeaders() },
      }
    );

    const estado = response.data?.detalles[0].estado;
    console.log("response:", response.data);
    console.log("Estado SII:", response.data?.detalles[0].estado);
    console.log("Errores:", response.data?.detalles[0].errores);
    return estado;
  } catch (err) {
    console.error(
      "Error consultando estado DTE:",
      err.response?.data || err.message
    );
    throw err;
  }
}

// --- Ejemplo de uso ---
(async () => {
  const trackId = "25436099"; // Reemplaza con tu track_id
  const estado = await consultarEstadoDTE(trackId);
  console.log(`Estado final del DTE (${trackId}):`, estado);
})();
