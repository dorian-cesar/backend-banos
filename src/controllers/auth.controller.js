const db = require('../config/db.config');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendPasswordResetEmail } = require("../services/mailer.service");
const getAppUrlFromReq = require('../helpers/selectURL');

const SECRET_KEY = process.env.JWT_SECRET;
const RESET_SECRET = process.env.RESET_SECRET;

const ALLOWED_ROLES = new Set(['admin', 'supervisor', 'recaudador', 'tesorero']);

exports.loginAdmin = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    try {
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = rows[0];

        // 🔒 Verificar si la cuenta está activa
        if (!user.is_active) {
            return res.status(403).json({ error: 'La cuenta está inactiva. Contacte al administrador.' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const role = String(user.role || '').toLowerCase().trim();

        if (!ALLOWED_ROLES.has(role)) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            SECRET_KEY,
            { expiresIn: '12h' }
        );

        res.json({
            message: 'Login exitoso',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                is_active: !!user.is_active
            }
        });
    } catch (error) {
        console.error('Error en loginAdmin:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    try {
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = rows[0];

        // 🔒 Verificar si la cuenta está activa
        if (!user.is_active) {
            return res.status(403).json({ error: 'La cuenta está inactiva. Contacte al administrador.' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            SECRET_KEY,
            { expiresIn: '12h' }
        );

        res.json({
            message: 'Login exitoso',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                is_active: !!user.is_active
            }
        });
    } catch (error) {
        console.error('Error en loginUser:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.forgot = async (req, res) => {
    const { email } = req.body;
    const GENERIC_MSG = 'Si el correo existe, te enviaremos instrucciones.';

    try {
        if (!email) return res.status(400).json({ ok: false, message: 'Ingrese un correo válido' });

        const normalized = String(email).toLowerCase().trim();
        const [rows] = await db.query('SELECT id, email, password FROM users WHERE email = ?', [normalized]);
        if (rows.length === 0) {
            // Puedes responder genérico para no filtrar si existe o no
            return res.json({ ok: true, message: GENERIC_MSG });
        }

        const user = rows[0];
        const token = jwt.sign({ sub: user.id, prp: 'pwd_reset', pw: user.password }, RESET_SECRET, { expiresIn: '30m' });

        const APP_URL = getAppUrlFromReq(req);
        const resetUrl = `${APP_URL.replace(/\/+$/, '')}/reset?token=${encodeURIComponent(token)}`;

        await sendPasswordResetEmail(user.email, resetUrl, 'Terminales');

        return res.json({ ok: true, message: GENERIC_MSG });
    } catch (err) {
        console.error('Error en forgot:', err);
        return res.status(500).json({ ok: false, message: 'No se pudo enviar el correo. Reintente más tarde.' });
    }
};


exports.reset = async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ ok: false, message: 'Datos inválidos' });
    }

    if (String(newPassword).length < 6) {
        return res.status(400).json({ ok: false, message: 'La contraseña debe tener al menos 6 caracteres' });
    }

    try {
        const payload = jwt.verify(token, RESET_SECRET);

        if (payload.prp !== 'pwd_reset' || !payload.sub || !payload.pw) {
            return res.status(400).json({ ok: false, message: 'Token inválido o expirado (payload)' });
        }

        const [rows] = await db.query(
            'SELECT id, password FROM users WHERE id = ?',
            [payload.sub]
        );
        if (rows.length === 0) {
            return res.status(400).json({ ok: false, message: 'usuario no encontrado' });
        }

        const user = rows[0];

        if (user.password !== payload.pw) {
            return res.status(400).json({ ok: false, message: 'Token inválido o expirado (pw)' });
        }

        const passwordHash = await bcrypt.hash(String(newPassword), 12);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [passwordHash, user.id]);

        return res.json({ ok: true, message: 'Contraseña actualizada' });
    } catch (err) {
        console.error('Error en reset:', err);
        return res.status(400).json({ ok: false, message: 'Token inválido o expirado (catch)' });
    }
};