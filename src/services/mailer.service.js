// services/mailer.service.js
const nodemailer = require('nodemailer');
const dotenv = require("dotenv");
dotenv.config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,          // o 587 con secure: false
  secure: true,       // true para 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // App Password
  },
});

// Verifica conexión al arrancar (una vez)
transporter.verify().then(() => {
  console.log('[mailer] SMTP listo');
}).catch(err => {
  console.error('[mailer] Error SMTP:', err);
});

async function sendPasswordResetEmail(to, resetUrl, appName = 'Terminales') {
  const subject = `${appName} · Restablecer contraseña`;
  const text = `Para restablecer tu contraseña abre este enlace (válido 30 minutos): ${resetUrl}`;
  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;">
    <h2>Restablecer contraseña</h2>
    <p>Haz clic en el botón o copia el enlace (vence en 30 min):</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${resetUrl}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block;">Cambiar contraseña</a>
    </p>
    <p style="word-break:break-all;"><a href="${resetUrl}">${resetUrl}</a></p>
  </div>`;

  const from = process.env.MAIL_FROM || process.env.SMTP_USER;

  try {
    const info = await transporter.sendMail({ from, to, subject, text, html });
    console.log('[mailer] Enviado:', info.messageId);
    return info;
  } catch (err) {
    console.error('[mailer] Error sendMail:', err);
    throw err; // muy importante: propagar error
  }
}

module.exports = { sendPasswordResetEmail };
