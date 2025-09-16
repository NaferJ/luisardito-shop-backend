const { Usuario, Canje, HistorialPunto, sequelize } = require('../models');

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

// Listar todos los usuarios con estadísticas (admin por permiso)
exports.listarUsuarios = async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
        const offset = req.query.offset ? parseInt(req.query.offset) : undefined;

        const usuarios = await Usuario.findAll({
            attributes: [
                'id',
                'nickname',
                'email',
                'puntos',
                'rol_id',
                'user_id_ext',
                'creado',
                'actualizado',
                [
                    sequelize.literal(`(
                        SELECT COUNT(*) FROM canjes WHERE canjes.usuario_id = Usuario.id
                    )`),
                    'total_canjes'
                ],
                [
                    sequelize.literal(`(
                        SELECT COUNT(*) FROM canjes WHERE canjes.usuario_id = Usuario.id AND canjes.estado = 'pendiente'
                    )`),
                    'canjes_pendientes'
                ]
            ],
            order: [['creado', 'DESC']],
            limit,
            offset
        });

        res.json(usuarios);
    } catch (error) {
        console.error('Error al listar usuarios:', error);
        res.status(500).json({ error: 'Error interno del servidor', message: error.message });
    }
};

// Actualizar puntos de un usuario (admin por permiso)
exports.actualizarPuntos = async (req, res) => {
    const t = await Usuario.sequelize.transaction();
    try {
        const { id } = req.params;
        const { puntos, motivo } = req.body;
        const adminNickname = req.user.nickname;

        const puntosNum = Number(puntos);
        if (!Number.isFinite(puntosNum) || puntosNum < 0) {
            await t.rollback();
            return res.status(400).json({ error: 'Cantidad de puntos inválida' });
        }
        if (!motivo || String(motivo).trim() === '') {
            await t.rollback();
            return res.status(400).json({ error: 'Motivo es requerido' });
        }

        const usuario = await Usuario.findByPk(id, { transaction: t });
        if (!usuario) {
            await t.rollback();
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const puntosAnteriores = usuario.puntos;
        const cambio = puntosNum - puntosAnteriores;

        await usuario.update({ puntos: puntosNum }, { transaction: t });

        await HistorialPunto.create({
            usuario_id: usuario.id,
            cambio,
            motivo: `${motivo} (Admin: ${adminNickname})`
        }, { transaction: t });

        await t.commit();

        res.json({
            message: 'Puntos actualizados correctamente',
            usuario: {
                id: usuario.id,
                nickname: usuario.nickname,
                puntosAnteriores,
                puntosNuevos: puntosNum,
                cambio
            },
            motivo,
            administrador: adminNickname
        });
    } catch (error) {
        await t.rollback();
        console.error('Error al actualizar puntos:', error);
        res.status(500).json({ error: 'Error interno del servidor', message: error.message });
    }
};
