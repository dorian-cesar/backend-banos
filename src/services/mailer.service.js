const nodemailer = require('nodemailer');
const dotenv = require("dotenv");
dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
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

    await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to,
        subject,
        text,
        html,
    });
}

module.exports = { sendPasswordResetEmail };
