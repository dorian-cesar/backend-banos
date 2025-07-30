const db = require('../config/db.config');
const bcrypt = require('bcrypt');

// Obtener todos los usuarios
exports.getAllUsers = async (req, res) => {
    try {
        const [results] = await db.query('SELECT id, username, email, role FROM users');
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err });
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


// Crear nuevo usuario
exports.createUser = async (req, res) => {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
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

    try {

        let updateQuery = 'UPDATE users SET username = ?, email = ?, role = ?';
        let values = [username, email, role];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateQuery += ', password = ?';
            values.push(hashedPassword);
        }

        updateQuery += ' WHERE id = ?';
        values.push(id);

        await db.query(updateQuery, values);

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
