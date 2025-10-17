const db = require('../../config/db.config');
const bcrypt = require('bcrypt');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
    return EMAIL_REGEX.test(email);
}

// Obtener todos los usuarios
exports.getAllUsers = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 100);
        const searchRaw = (req.query.search || '').trim();
        const requesterRole = (req.user?.role || '').toLowerCase();

        const where = [];
        const params = [];

        // Búsqueda
        if (searchRaw) {
            const search = `%${searchRaw}%`;
            where.push(`(username LIKE ? OR email LIKE ? OR role LIKE ?)`);
            params.push(search, search, search);
        }

        // Si NO es admin, no puede ver admins
        if (requesterRole !== 'admin') {
            where.push(`LOWER(role) <> 'admin'`);
        }

        //no mostrar admin principal
        where.push(`id <> 1`);

        const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

        // Total con el mismo WHERE
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM users ${whereSQL}`,
            params
        );

        const offset = (page - 1) * pageSize;

        // Datos con el mismo WHERE
        const [results] = await db.query(
            `SELECT id, username, email, role, is_active
         FROM users
         ${whereSQL}
         ORDER BY id DESC
         LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );

        res.json({ total, page, pageSize, data: results });
    } catch (err) {
        console.error('getAllUsers error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Obtener un usuario por ID
exports.getUserById = async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await db.query('SELECT id, username, email, role, is_active FROM users WHERE id = ?', [id]);
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
    const { username, email, password, role, is_active } = req.body;

    // Validaciones básicas
    if (!username || !email || !password || !role) {
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Email inválido' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    try {
        // Verificar si el correo ya está en uso
        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'El email ya está en uso' });
        }

        // Encriptar la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Convertir el estado a valor lógico/numérico
        const activeValue = is_active === true || is_active === 1 ? 1 : 0;

        // Insertar el nuevo usuario incluyendo el campo is_active
        const [result] = await db.query(
            'INSERT INTO users (username, email, password, role, is_active) VALUES (?, ?, ?, ?, ?)',
            [username, email, hashedPassword, role.toLowerCase(), activeValue]
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
    const { username, email, password, role, is_active } = req.body;

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
        // Verificar si el email cambió y si está en uso por otro usuario
        const [existingEmailRows] = await db.query(
            'SELECT id FROM users WHERE email = ? AND id != ?',
            [email, id]
        );
        if (existingEmailRows.length > 0) {
            return res.status(409).json({ error: 'El email ya está en uso por otro usuario' });
        }

        // Base del query
        let updateQuery = 'UPDATE users SET username = ?, email = ?, role = ?, is_active = ?';
        const values = [username, email, role.toLowerCase(), is_active === true || is_active === 1 ? 1 : 0];

        // Si se envía contraseña, la actualizamos también
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

        res.json({ message: 'Usuario actualizado correctamente' });
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
