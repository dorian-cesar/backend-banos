const jwt = require("jsonwebtoken");

const JWT_SECRET = "coloca_un_secreto_largo_aca";
const payload = { id: 1, name: "Diego" };
const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
console.log(token);
