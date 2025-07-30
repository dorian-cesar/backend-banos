const mysql = require('mysql2');
const dotenv = require('dotenv');
dotenv.config();

const connection = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}).promise();

(async () => {
  try {
    await connection.query('SELECT 1');
    console.log('Conectado a la base de datos MySQL');
  } catch (err) {
    console.error('Error al conectar a la base de datos:', err);
    process.exit(1);
  }
})();

module.exports = connection;
