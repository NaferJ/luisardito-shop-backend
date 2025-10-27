const { Usuario, Canje, HistorialPunto, sequelize } = require('../models');
const { uploadKickAvatarToCloudinary } = require('../utils/uploadAvatar');
const { extractAvatarUrl, getKickUserData } = require('../utils/kickApi');

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

// Sincronizar información de Kick (avatar, username, etc.)
exports.syncKickInfo = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await Usuario.findByPk(userId);

        if (!user || !user.user_id_ext) {
            return res.status(400).json({
                error: 'Usuario no conectado con Kick',
                details: 'Debes conectar tu cuenta con Kick primero'
            });
        }

        console.log(`[Sync Kick Info] Sincronizando datos para usuario ${user.nickname} (ID: ${userId})`);

        // Obtener datos actualizados de Kick usando el ID externo
        let kickUserData;
        try {
            kickUserData = await getKickUserData(user.user_id_ext);
            console.log(`[Sync Kick Info] Datos obtenidos de Kick:`, {
                name: kickUserData?.name,
                user_id: kickUserData?.user_id,
                profile_picture: kickUserData?.profile_picture ? 'presente' : 'ausente'
            });
        } catch (kickError) {
            console.error('[Sync Kick Info] Error obteniendo datos de Kick:', kickError.message);
            return res.status(500).json({
                error: 'No se pudieron obtener datos actualizados de Kick',
                details: kickError.message
            });
        }

        if (!kickUserData) {
            return res.status(404).json({
                error: 'Usuario no encontrado en Kick',
                details: 'El usuario puede haber sido eliminado o no ser público'
            });
        }

        // Procesar avatar
        let cloudinaryAvatarUrl = user.kick_data?.avatar_url || null; // Mantener el actual si falla
        const kickAvatarUrl = extractAvatarUrl(kickUserData);

        if (kickAvatarUrl) {
            try {
                console.log(`[Sync Kick Info] Procesando avatar para usuario ${userId}`);
                cloudinaryAvatarUrl = await uploadKickAvatarToCloudinary(kickAvatarUrl, userId);
                console.log(`[Sync Kick Info] ✅ Avatar actualizado en Cloudinary:`, cloudinaryAvatarUrl);
            } catch (avatarError) {
                console.warn('[Sync Kick Info] Error actualizando avatar, manteniendo el anterior:', avatarError.message);
                // No fallar la sincronización por problemas con el avatar
            }
        } else {
            console.log('[Sync Kick Info] No se encontró avatar en los datos de Kick');
        }

        // Actualizar usuario con datos sincronizados
        const updatedKickData = {
            ...user.kick_data,
            username: kickUserData.name || kickUserData.username,
            avatar_url: cloudinaryAvatarUrl,
            user_id: kickUserData.user_id || kickUserData.id,
            last_sync: new Date().toISOString()
        };

        await user.update({
            nickname: kickUserData.name || kickUserData.username || user.nickname,
            kick_data: updatedKickData
        });

        console.log(`[Sync Kick Info] ✅ Usuario sincronizado exitosamente`);

        // Devolver usuario actualizado
        const updatedUser = await Usuario.findByPk(userId);

        res.json({
            message: 'Información sincronizada exitosamente',
            user: {
                id: updatedUser.id,
                nickname: updatedUser.nickname,
                email: updatedUser.email,
                puntos: updatedUser.puntos,
                rol_id: updatedUser.rol_id,
                kick_data: updatedUser.kick_data,
                creado: updatedUser.creado,
                actualizado: updatedUser.actualizado
            },
            changes: {
                avatar_updated: cloudinaryAvatarUrl !== user.kick_data?.avatar_url,
                username_updated: (kickUserData.name || kickUserData.username) !== user.nickname
            }
        });

    } catch (error) {
        console.error('[Sync Kick Info] Error general:', error.message);
        res.status(500).json({
            error: 'Error al sincronizar información',
            details: error.message
        });
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
            puntos: cambio,  // La cantidad del cambio (positivo o negativo)
            cambio,  // Campo legacy para compatibilidad
            tipo: cambio > 0 ? 'ganado' : cambio < 0 ? 'gastado' : 'ajuste',
            concepto: `Ajuste de puntos: ${motivo} (Admin: ${adminNickname})`,
            motivo: `${motivo} (Admin: ${adminNickname})`  // Campo legacy para compatibilidad
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

/**
 * 🔍 DEBUG: Verificar permisos del usuario actual
 */
exports.debugPermisos = async (req, res) => {
    try {
        const { Rol, Permiso, RolPermiso } = require('../models');

        // Obtener información completa del usuario
        const userWithRole = await Usuario.findByPk(req.user.id, {
            include: [{
                model: Rol,
                include: [{
                    model: Permiso,
                    through: { attributes: [] } // Excluir tabla intermedia
                }]
            }]
        });

        if (!userWithRole) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const permisos = userWithRole.Rol?.Permisos?.map(p => p.nombre) || [];

        res.json({
            usuario: {
                id: userWithRole.id,
                nickname: userWithRole.nickname,
                email: userWithRole.email,
                rol_id: userWithRole.rol_id,
                rol_nombre: userWithRole.Rol?.nombre,
                rol_descripcion: userWithRole.Rol?.descripcion
            },
            permisos: permisos,
            permisos_detalle: userWithRole.Rol?.Permisos?.map(p => ({
                id: p.id,
                nombre: p.nombre,
                descripcion: p.descripcion
            })) || [],
            verificaciones: {
                puede_ver_historial_puntos: permisos.includes('ver_historial_puntos'),
                puede_canjear_productos: permisos.includes('canjear_productos'),
                puede_ver_canjes: permisos.includes('ver_canjes'),
                es_admin: userWithRole.rol_id >= 3
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[Debug Permisos] Error:', error);
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
};

/**
 * 🔍 DEBUG: Verificar estructura de roles y permisos en la BD (sin auth)
 */
exports.debugRolesPermisos = async (req, res) => {
    try {
        const { Rol, Permiso, RolPermiso, Usuario } = require('../models');

        // 1. Obtener todos los roles
        const roles = await Rol.findAll({
            include: [{
                model: Permiso,
                through: { attributes: [] }
            }],
            order: [['id', 'ASC']]
        });

        // 2. Obtener todos los permisos
        const permisos = await Permiso.findAll({
            order: [['id', 'ASC']]
        });

        // 3. Obtener todas las relaciones rol-permiso
        const rolPermisos = await RolPermiso.findAll({
            order: [['rol_id', 'ASC'], ['permiso_id', 'ASC']]
        });

        // 4. Estadísticas de usuarios por rol
        const usuariosPorRol = await Usuario.findAll({
            attributes: [
                'rol_id',
                [Usuario.sequelize.fn('COUNT', Usuario.sequelize.col('id')), 'total_usuarios']
            ],
            group: ['rol_id'],
            order: [['rol_id', 'ASC']]
        });

        // 5. Verificar específicamente el permiso 'ver_historial_puntos'
        const permisoHistorial = await Permiso.findOne({
            where: { nombre: 'ver_historial_puntos' }
        });

        const rolesConPermisoHistorial = permisoHistorial ? await RolPermiso.findAll({
            where: { permiso_id: permisoHistorial.id },
            include: [{ model: Rol }]
        }) : [];

        res.json({
            debug_estructura: {
                total_roles: roles.length,
                total_permisos: permisos.length,
                total_relaciones: rolPermisos.length
            },
            roles: roles.map(r => ({
                id: r.id,
                nombre: r.nombre,
                descripcion: r.descripcion,
                permisos: r.Permisos?.map(p => p.nombre) || [],
                total_permisos: r.Permisos?.length || 0
            })),
            permisos: permisos.map(p => ({
                id: p.id,
                nombre: p.nombre,
                descripcion: p.descripcion
            })),
            usuarios_por_rol: usuariosPorRol.map(u => ({
                rol_id: u.rol_id,
                total_usuarios: parseInt(u.dataValues.total_usuarios)
            })),
            permiso_historial_puntos: {
                existe: !!permisoHistorial,
                id: permisoHistorial?.id,
                nombre: permisoHistorial?.nombre,
                roles_que_lo_tienen: rolesConPermisoHistorial.map(rp => ({
                    rol_id: rp.rol_id,
                    rol_nombre: rp.Rol?.nombre
                }))
            },
            verificacion_rol_1: {
                rol_usuario_basico: roles.find(r => r.id === 1),
                tiene_permiso_historial: roles.find(r => r.id === 1)?.Permisos?.some(p => p.nombre === 'ver_historial_puntos') || false
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[Debug Roles/Permisos] Error:', error);
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
};

/**
 * 🔍 DEBUG: Verificar usuario específico por ID (sin auth)
 */
exports.debugUsuarioEspecifico = async (req, res) => {
    try {
        const { Rol, Permiso } = require('../models');
        const { usuarioId } = req.params;

        // Obtener usuario específico con rol y permisos
        const usuario = await Usuario.findByPk(usuarioId, {
            include: [{
                model: Rol,
                include: [{
                    model: Permiso,
                    through: { attributes: [] }
                }]
            }]
        });

        if (!usuario) {
            return res.status(404).json({
                error: 'Usuario no encontrado',
                usuario_id: usuarioId
            });
        }

        const permisos = usuario.Rol?.Permisos?.map(p => p.nombre) || [];

        res.json({
            usuario: {
                id: usuario.id,
                nickname: usuario.nickname,
                email: usuario.email,
                rol_id: usuario.rol_id,
                user_id_ext: usuario.user_id_ext,
                creado: usuario.creado,
                actualizado: usuario.actualizado
            },
            rol: {
                id: usuario.Rol?.id,
                nombre: usuario.Rol?.nombre,
                descripcion: usuario.Rol?.descripcion
            },
            permisos: permisos,
            permisos_detalle: usuario.Rol?.Permisos?.map(p => ({
                id: p.id,
                nombre: p.nombre,
                descripcion: p.descripcion
            })) || [],
            verificaciones: {
                puede_ver_historial_puntos: permisos.includes('ver_historial_puntos'),
                puede_canjear_productos: permisos.includes('canjear_productos'),
                puede_ver_canjes: permisos.includes('ver_canjes'),
                es_admin: usuario.rol_id >= 3,
                puede_ver_propio_historial: true, // Siempre pueden ver su propio historial
                puede_ver_historial_otros: usuario.rol_id >= 3 // Solo admins pueden ver de otros
            },
            diagnostico: {
                problema_identificado: !permisos.includes('ver_historial_puntos') ?
                    'Usuario NO tiene el permiso ver_historial_puntos' :
                    'Usuario SÍ tiene el permiso ver_historial_puntos',
                logica_esperada: usuario.rol_id <= 2 ?
                    'Solo puede ver su propio historial (usuarios básicos)' :
                    'Puede ver cualquier historial (administrador)'
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[Debug Usuario Específico] Error:', error);
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
};
