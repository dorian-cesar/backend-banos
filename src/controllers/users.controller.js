const db = require('../config/db.config');
const bcrypt = require('bcrypt');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
    return EMAIL_REGEX.test(email);
}

// Obtener todos los usuarios
exports.getAllUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const search = req.query.search ? `%${req.query.search}%` : '%%';
        const offset = (page - 1) * pageSize;

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total 
             FROM users 
             WHERE username LIKE ? OR email LIKE ? OR role LIKE ?`,
            [search, search, search]
        );

        const [results] = await db.query(
            `SELECT id, username, email, role
             FROM users
             WHERE username LIKE ? OR email LIKE ? OR role LIKE ?
             ORDER BY id DESC
             LIMIT ? OFFSET ?`,
            [search, search, search, pageSize, offset]
        );

        res.json({ total, page, pageSize, data: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Obtener un usuario por ID
exports.getUserById = async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await db.query('SELECT id, username, email, role FROM users WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error al obtener usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Nuevo endpoint para roles
exports.getRoles = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT DISTINCT role FROM users ORDER BY role ASC'
        );
        const roles = rows.map(r => r.role);
        res.json(roles);
    } catch (err) {
        console.error('Error obteniendo roles:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Crear nuevo usuario
exports.createUser = async (req, res) => {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Email inválido' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
        return res.status(409).json({ error: 'El email ya está en uso' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, role],
        );
        res.status(201).json({ message: 'Usuario creado', id: result.insertId });
    } catch (error) {
        console.error('Error al crear usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Actualizar usuario
exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { username, email, password, role } = req.body;

    if (!username || !email || !role) {
        return res.status(400).json({ error: 'username, email y role son requeridos' });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Email inválido' });
    }

    if (password && password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres si se proporciona' });
    }

    try {
        // Verificar si el email cambió y si está en uso por otro
        const [existingEmailRows] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
        if (existingEmailRows.length > 0) {
            return res.status(409).json({ error: 'El email ya está en uso por otro usuario' });
        }

        let updateQuery = 'UPDATE users SET username = ?, email = ?, role = ?';
        const values = [username, email, role.toLowerCase()];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateQuery += ', password = ?';
            values.push(hashedPassword);
        }

        updateQuery += ' WHERE id = ?';
        values.push(id);

        const [result] = await db.query(updateQuery, values);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ message: 'Usuario actualizado' });
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Eliminar usuario
exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.json({ message: 'Usuario eliminado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err });
    }
};
