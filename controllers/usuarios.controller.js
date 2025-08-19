// Mostrar datos del usuario autenticado
exports.me = async (req, res) => {
    const { id, nickname, email, puntos, rol_id, kick_data, creado, actualizado } = req.user;
    res.json({ id, nickname, email, puntos, rol_id, kick_data, creado, actualizado });
};

// Opcional: editar perfil
exports.updateMe = async (req, res) => {
    try {
        const updates = req.body;
        if (updates.password) {
            const bcrypt = require('bcryptjs');
            updates.password_hash = await bcrypt.hash(updates.password, 10);
            delete updates.password;
        }
        await req.user.update(updates);
        res.json({ message: 'Perfil actualizado' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};
