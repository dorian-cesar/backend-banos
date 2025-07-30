const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const routes = require('./src/routes/index.routes')

dotenv.config();
const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());

app.use(express.json());

app.use('/api', routes);

// server
app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
