// cronJobs.js
const cron = require('node-cron');
const axios = require('axios');

// Si usas variables de entorno, asegúrate de cargarlas
 require('dotenv').config();

const executeDeletionJob = async () => {
  const pages = [25, 26, 27, 28, 29];
  // Asegúrate de que estas variables estén definidas o importadas


const apiToken = process.env.ZKBIO_API_TOKEN; 
const serverIP = process.env.ZKBIO_SERVER_IP;
const serverPort = process.env.ZKBIO_SERVER_PORT;

  console.log(`\n⏰ [${new Date().toLocaleString()}] Iniciando Cron de limpieza masiva...`);

  try {
    for (const page of pages) {
      console.log(`📄 Procesando Página ${page}...`);
      
      const getUrl = `http://${serverIP}:${serverPort}/api/v2/person/getPersonList?deptCodes=7&pageNo=${page}&pageSize=1000&access_token=${apiToken}`;
      const listResponse = await axios.post(getUrl, {}, { headers: { "Content-Type": "application/json" } });

      const userData = listResponse.data.data?.data || [];
      const pinsToDelete = userData.map(user => user.pin);

      for (const pin of pinsToDelete) {
        try {
          const deleteUrl = `http://${serverIP}:${serverPort}/api/v2/person/delete?pin=${pin}&access_token=${apiToken}`;
          await axios.post(deleteUrl, {}, { headers: { "Content-Type": "application/json" } });
        } catch (err) {
          // Fallo silencioso
        }
      }
      console.log(`✅ Página ${page} limpiada.`);
    }
    console.log(`🚀 [${new Date().toLocaleString()}] Cron finalizado con éxito.`);
  } catch (error) {
    console.error("❌ Error en la ejecución del Cron:", error.message);
  }
};

// Función para inicializar todos los crons
const initCrons = () => {
  cron.schedule('0 * * * *', () => {
    executeDeletionJob();
  }, {
    scheduled: true,
    timezone: "America/Bogota"
  });
  
  console.log("📅 Cron de limpieza programado (cada hora)");
};

module.exports = { initCrons };
