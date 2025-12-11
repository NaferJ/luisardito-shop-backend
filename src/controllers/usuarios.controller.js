const {
  Usuario,
  Canje,
  HistorialPunto,
  sequelize,
  KickUserTracking,
  DiscordUserLink,
} = require("../models");
const { uploadKickAvatarToCloudinary } = require("../utils/uploadAvatar");
const { extractAvatarUrl, getKickUserData } = require("../utils/kickApi");
const logger = require("../utils/logger");
const axios = require("axios");
const { KickBroadcasterToken } = require("../models");

/**
 * Función helper para enriquecer información de usuario con datos de Discord
 * @param {Object} user - Instancia del modelo Usuario
 * @returns {Object} Información enriquecida de Discord
 */
async function enrichUserWithDiscordInfo(user) {
  let discordInfo = null;
  const discordLink = await DiscordUserLink.findOne({
    where: { tienda_user_id: user.id }
  });

  if (discordLink) {
    discordInfo = {
      linked: true,
      id: discordLink.discord_user_id,
      username: discordLink.discord_username,
      discriminator: discordLink.discord_discriminator,
      avatar: discordLink.discord_avatar,
      linked_at: discordLink.createdAt,
      display_name: discordLink.discord_discriminator && discordLink.discord_discriminator !== '0'
        ? `${discordLink.discord_username}#${discordLink.discord_discriminator}`
        : discordLink.discord_username
    };
  }

  return {
    discord_info: discordInfo,
    display_name: discordInfo?.display_name || user.nickname
  };
}

// Mostrar datos del usuario autenticado
exports.me = async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "Usuario no autenticado" });
  }

  const {
    id,
    nickname,
    email,
    puntos,
    rol_id,
    kick_data,
    discord_username,
    is_vip,
    vip_granted_at,
    vip_expires_at,
    vip_granted_by_canje_id,
    botrix_migrated,
    botrix_migrated_at,
    botrix_points_migrated,
    creado,
    actualizado,
  } = user;

  // Calcular información de suscriptor
  let subscriberStatus = {
    is_active: false,
    expires_soon: false,
  };

  // Obtener información de Discord vinculado
  const { discord_info, display_name } = await enrichUserWithDiscordInfo(user);

  if (user.user_id_ext) {
    const userTracking = await KickUserTracking.findOne({
      where: { kick_user_id: user.user_id_ext },
    });

    if (userTracking?.is_subscribed) {
      const now = new Date();
      const expiresAt = userTracking.subscription_expires_at
        ? new Date(userTracking.subscription_expires_at)
        : null;
      subscriberStatus = {
        is_active: !expiresAt || expiresAt > now,
        expires_soon:
          expiresAt &&
          expiresAt <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
    }
  }

  res.json({
    id,
    nickname,
    display_name,
    email,
    puntos,
    rol_id,
    kick_data,
    discord_username,
    discord_info,
    vip_status: {
      is_active: user.isVipActive(),
      is_permanent: is_vip && !vip_expires_at,
      expires_soon:
        vip_expires_at &&
        new Date(vip_expires_at) <=
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      granted_at: vip_granted_at,
      expires_at: vip_expires_at,
      granted_by_canje_id: vip_granted_by_canje_id,
    },
    migration_status: {
      can_migrate: user.canMigrateBotrix(),
      migrated: botrix_migrated,
      migrated_at: botrix_migrated_at,
      points_migrated: botrix_points_migrated,
    },
    user_type: user.getUserType(),
    subscriber_status: subscriberStatus,
    creado,
    actualizado,
  });
};

// Opcional: editar perfil
exports.updateMe = async (req, res) => {
  try {
    const updates = req.body;
    const allowedFields = ["discord_username", "password"];

    // Filtrar solo campos permitidos
    const filteredUpdates = {};
    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key) || key === "password") {
        filteredUpdates[key] = updates[key];
      }
    });

    if (filteredUpdates.password) {
      const bcrypt = require("bcryptjs");
      filteredUpdates.password_hash = await bcrypt.hash(
        filteredUpdates.password,
        10,
      );
      delete filteredUpdates.password;
    }

    await req.user.update(filteredUpdates);

    res.json({
      message: "Perfil actualizado",
      updated_fields: Object.keys(filteredUpdates),
    });
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
        "id",
        "nickname",
        "email",
        "puntos",
        "rol_id",
        "user_id_ext",
        "discord_username",
        "is_vip",
        "vip_granted_at",
        "vip_expires_at",
        "vip_granted_by_canje_id",
        "botrix_migrated",
        "botrix_migrated_at",
        "botrix_points_migrated",
        "kick_data",
        "creado",
        "actualizado",
        [
          sequelize.literal(`(
                        SELECT COUNT(*) FROM canjes WHERE canjes.usuario_id = Usuario.id
                    )`),
          "total_canjes",
        ],
        [
          sequelize.literal(`(
                        SELECT COUNT(*) FROM canjes WHERE canjes.usuario_id = Usuario.id AND canjes.estado = 'pendiente'
                    )`),
          "canjes_pendientes",
        ],
      ],
      order: [["creado", "DESC"]],
      limit,
      offset,
    });

    // Enriquecer datos con información adicional
    const enrichedUsers = await Promise.all(
      usuarios.map(async (user) => {
        const userData = user.toJSON();
        const userInstance = Usuario.build(userData);

        // Obtener información de Discord vinculado
        const { discord_info, display_name } = await enrichUserWithDiscordInfo(userInstance);

        // Calcular información de suscriptor
        let subscriberStatus = {
          is_active: false,
          expires_soon: false,
        };

        if (userData.user_id_ext) {
          const userTracking = await KickUserTracking.findOne({
            where: { kick_user_id: userData.user_id_ext },
          });

          if (userTracking?.is_subscribed) {
            const now = new Date();
            const expiresAt = userTracking.subscription_expires_at
              ? new Date(userTracking.subscription_expires_at)
              : null;
            subscriberStatus = {
              is_active: !expiresAt || expiresAt > now,
              expires_soon:
                expiresAt &&
                expiresAt <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            };
          }
        }

        return {
          ...userData,
          display_name,
          discord_info,
          vip_status: {
            is_active: userInstance.isVipActive(),
            is_permanent: userData.is_vip && !userData.vip_expires_at,
            expires_soon:
              userData.vip_expires_at &&
              new Date(userData.vip_expires_at) <=
                new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
          },
          subscriber_status: subscriberStatus,
          migration_status: {
            can_migrate: userInstance.canMigrateBotrix(),
            points_migrated: userData.botrix_points_migrated || 0,
          },
          user_type: userInstance.getUserType(),
        };
      }),
    );

    res.json(enrichedUsers);
  } catch (error) {
    logger.error("Error al listar usuarios:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", message: error.message });
  }
};

// ============================================================================
// ENDPOINTS DE DEBUG
// ============================================================================

/**
 * DEBUG: Obtener información completa de un usuario específico
 */
exports.debugUsuario = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const { Rol, Permiso, RolPermiso } = require("../models");

    const usuario = await Usuario.findByPk(usuarioId, {
      include: [
        {
          model: Rol,
          include: [
            {
              model: RolPermiso,
              include: [Permiso],
            },
          ],
        },
      ],
    });

    if (!usuario) {
      return res.status(404).json({
        success: false,
        error: "Usuario no encontrado",
      });
    }

    const permisos =
      usuario.Rol?.RolPermisos?.map((rp) => rp.Permiso.nombre) || [];
    const permisosDetalle =
      usuario.Rol?.RolPermisos?.map((rp) => ({
        id: rp.Permiso.id,
        nombre: rp.Permiso.nombre,
        descripcion: rp.Permiso.descripcion,
      })) || [];

    const userInstance = Usuario.build(usuario.toJSON());

    // Calcular información de suscriptor
    let subscriberInfo = {
      is_subscriber: false,
      is_active: false,
      expires_at: null,
    };

    if (usuario.user_id_ext) {
      const userTracking = await KickUserTracking.findOne({
        where: { kick_user_id: usuario.user_id_ext },
      });

      if (userTracking?.is_subscribed) {
        const now = new Date();
        const expiresAt = userTracking.subscription_expires_at
          ? new Date(userTracking.subscription_expires_at)
          : null;
        subscriberInfo = {
          is_subscriber: true,
          is_active: !expiresAt || expiresAt > now,
          expires_at: expiresAt,
        };
      }
    }

    res.json({
      usuario: {
        id: usuario.id,
        nickname: usuario.nickname,
        email: usuario.email,
        rol_id: usuario.rol_id,
        user_id_ext: usuario.user_id_ext,
        creado: usuario.creado,
        actualizado: usuario.actualizado,
      },
      rol: usuario.Rol
        ? {
            id: usuario.Rol.id,
            nombre: usuario.Rol.nombre,
            descripcion: usuario.Rol.descripcion,
          }
        : null,
      permisos: permisos,
      permisos_detalle: permisosDetalle,
      verificaciones: {
        puede_ver_historial_puntos: permisos.includes("ver_historial_puntos"),
        puede_canjear_productos: permisos.includes("canjear_productos"),
        puede_ver_canjes: permisos.includes("ver_canjes"),
        es_admin: usuario.rol_id >= 3,
        puede_ver_propio_historial: usuario.rol_id >= 1,
        puede_ver_historial_otros: permisos.includes("editar_puntos"),
      },
      vip_info: {
        is_vip: usuario.is_vip,
        is_active: userInstance.isVipActive(),
        granted_at: usuario.vip_granted_at,
        expires_at: usuario.vip_expires_at,
        granted_by_canje_id: usuario.vip_granted_by_canje_id,
        is_permanent: usuario.is_vip && !usuario.vip_expires_at,
      },
      botrix_info: {
        migrated: usuario.botrix_migrated,
        migrated_at: usuario.botrix_migrated_at,
        points_migrated: usuario.botrix_points_migrated,
        can_migrate: userInstance.canMigrateBotrix(),
      },
      user_type: userInstance.getUserType(),
      subscriber_info: subscriberInfo,
      diagnostico: {
        problema_identificado: permisos.includes("ver_historial_puntos")
          ? "Usuario SÍ tiene el permiso ver_historial_puntos"
          : "Usuario NO tiene el permiso ver_historial_puntos",
        logica_esperada:
          usuario.rol_id <= 2
            ? "Solo puede ver su propio historial (usuarios básicos)"
            : "Puede ver historial de cualquier usuario (admin)",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error en debug de usuario:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * DEBUG: Información completa del sistema de roles y permisos
 */
exports.debugRolesPermisos = async (req, res) => {
  try {
    const { Rol, Permiso, RolPermiso } = require("../models");

    // Obtener todos los roles con sus permisos
    const roles = await Rol.findAll({
      include: [
        {
          model: RolPermiso,
          include: [Permiso],
        },
      ],
    });

    // Obtener todos los permisos
    const permisos = await Permiso.findAll({
      order: [["id", "ASC"]],
    });

    // Contar usuarios por rol
    const usuariosPorRol = await Usuario.findAll({
      attributes: [
        "rol_id",
        [
          Usuario.sequelize.fn("COUNT", Usuario.sequelize.col("id")),
          "total_usuarios",
        ],
      ],
      group: ["rol_id"],
    });

    // Verificar específicamente el permiso ver_historial_puntos
    const permisoHistorial = await Permiso.findOne({
      where: { nombre: "ver_historial_puntos" },
      include: [
        {
          model: RolPermiso,
          include: [Rol],
        },
      ],
    });

    // Verificar rol 1 (usuario básico) específicamente
    const rolUsuario = await Rol.findByPk(1, {
      include: [
        {
          model: RolPermiso,
          include: [Permiso],
        },
      ],
    });

    res.json({
      debug_estructura: {
        total_roles: roles.length,
        total_permisos: permisos.length,
        total_relaciones: await RolPermiso.count(),
      },
      roles: roles.map((rol) => ({
        id: rol.id,
        nombre: rol.nombre,
        descripcion: rol.descripcion,
        permisos: rol.RolPermisos.map((rp) => rp.Permiso.nombre),
        total_permisos: rol.RolPermisos.length,
      })),
      permisos: permisos.map((permiso) => ({
        id: permiso.id,
        nombre: permiso.nombre,
        descripcion: permiso.descripcion,
      })),
      usuarios_por_rol: usuariosPorRol.map((u) => ({
        rol_id: u.rol_id,
        total_usuarios: parseInt(u.getDataValue("total_usuarios")),
      })),
      permiso_historial_puntos: permisoHistorial
        ? {
            existe: true,
            id: permisoHistorial.id,
            nombre: permisoHistorial.nombre,
            roles_que_lo_tienen: permisoHistorial.RolPermisos.map((rp) => ({
              rol_id: rp.Rol.id,
              rol_nombre: rp.Rol.nombre,
            })),
          }
        : { existe: false },
      verificacion_rol_1: {
        rol_usuario_basico: rolUsuario
          ? {
              id: rolUsuario.id,
              nombre: rolUsuario.nombre,
              descripcion: rolUsuario.descripcion,
              Permisos: rolUsuario.RolPermisos.map((rp) => ({
                id: rp.Permiso.id,
                nombre: rp.Permiso.nombre,
                descripcion: rp.Permiso.descripcion,
              })),
            }
          : null,
        tiene_permiso_historial: rolUsuario
          ? rolUsuario.RolPermisos.some(
              (rp) => rp.Permiso.nombre === "ver_historial_puntos",
            )
          : false,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error en debug de roles y permisos:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * HOTFIX: Actualizar rol de un usuario (temporal para correcciones)
 */
exports.hotfixActualizarRol = async (req, res) => {
  try {
    const { usuarioId, nuevoRolId } = req.params;

    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario) {
      return res.status(404).json({
        success: false,
        error: "Usuario no encontrado",
      });
    }

    const rolAnterior = usuario.rol_id;
    await usuario.update({ rol_id: parseInt(nuevoRolId) });

    res.json({
      success: true,
      mensaje: `Rol actualizado para ${usuario.nickname}`,
      usuario: {
        id: usuario.id,
        nickname: usuario.nickname,
        rol_anterior: rolAnterior,
        rol_nuevo: parseInt(nuevoRolId),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error en hotfix de rol:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Sincronizar información de Kick (avatar, username, etc.)
exports.syncKickInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await Usuario.findByPk(userId);

    if (!user || !user.user_id_ext) {
      return res.status(400).json({
        error: "Usuario no conectado con Kick",
        details: "Debes conectar tu cuenta con Kick primero",
      });
    }

    logger.info(
      `[Sync Kick Info] Sincronizando datos para usuario ${user.nickname} (ID: ${userId})`,
    );

    // Obtener datos actualizados de Kick usando el ID externo
    let kickUserData;
    try {
      kickUserData = await getKickUserData(user.user_id_ext);
      logger.info(`[Sync Kick Info] Datos obtenidos de Kick:`, {
        name: kickUserData?.name,
        user_id: kickUserData?.user_id,
        profile_picture: kickUserData?.profile_picture ? "presente" : "ausente",
      });
    } catch (kickError) {
      logger.error(
        "[Sync Kick Info] Error obteniendo datos de Kick:",
        kickError.message,
      );
      return res.status(500).json({
        error: "No se pudieron obtener datos actualizados de Kick",
        details: kickError.message,
      });
    }

    if (!kickUserData) {
      return res.status(404).json({
        error: "Usuario no encontrado en Kick",
        details: "El usuario puede haber sido eliminado o no ser público",
      });
    }

    // Procesar avatar
    let cloudinaryAvatarUrl = user.kick_data?.avatar_url || null; // Mantener el actual si falla
    const kickAvatarUrl = extractAvatarUrl(kickUserData);

    if (kickAvatarUrl) {
      try {
        logger.info(
          `[Sync Kick Info] Procesando avatar para usuario ${userId}`,
        );
        cloudinaryAvatarUrl = await uploadKickAvatarToCloudinary(
          kickAvatarUrl,
          userId,
        );
        logger.info(
          `[Sync Kick Info] ✅ Avatar actualizado en Cloudinary:`,
          cloudinaryAvatarUrl,
        );
      } catch (avatarError) {
        logger.warn(
          "[Sync Kick Info] Error actualizando avatar, manteniendo el anterior:",
          avatarError.message,
        );
        // No fallar la sincronización por problemas con el avatar
      }
    } else {
      logger.info(
        "[Sync Kick Info] No se encontró avatar en los datos de Kick",
      );
    }

    // Actualizar usuario con datos sincronizados
    const updatedKickData = {
      ...user.kick_data,
      username: kickUserData.name || kickUserData.username,
      avatar_url: cloudinaryAvatarUrl,
      user_id: kickUserData.user_id || kickUserData.id,
      last_sync: new Date().toISOString(),
    };

    await user.update({
      nickname: kickUserData.name || kickUserData.username || user.nickname,
      kick_data: updatedKickData,
    });

    logger.info(`[Sync Kick Info] ✅ Usuario sincronizado exitosamente`);

    // Devolver usuario actualizado
    const updatedUser = await Usuario.findByPk(userId);

    res.json({
      message: "Información sincronizada exitosamente",
      user: {
        id: updatedUser.id,
        nickname: updatedUser.nickname,
        email: updatedUser.email,
        puntos: updatedUser.puntos,
        rol_id: updatedUser.rol_id,
        kick_data: updatedUser.kick_data,
        creado: updatedUser.creado,
        actualizado: updatedUser.actualizado,
      },
      changes: {
        avatar_updated: cloudinaryAvatarUrl !== user.kick_data?.avatar_url,
        username_updated:
          (kickUserData.name || kickUserData.username) !== user.nickname,
      },
    });
  } catch (error) {
    logger.error("[Sync Kick Info] Error general:", error.message);
    res.status(500).json({
      error: "Error al sincronizar información",
      details: error.message,
    });
  }
};

// Actualizar puntos de un usuario (admin por permiso)
exports.actualizarPuntos = async (req, res) => {
  const t = await Usuario.sequelize.transaction();
  try {
    const { id } = req.params;
    const { puntos, motivo, operation = 'set' } = req.body; // operation: 'add' | 'set'
    const adminNickname = req.user.nickname;

    const puntosNum = Number(puntos);
    
    // Validar operation
    if (!['add', 'set'].includes(operation)) {
      await t.rollback();
      return res.status(400).json({ error: "Operation debe ser 'add' o 'set'" });
    }
    
    // Para 'add', permitir negativos (restar); para 'set', no permitir negativos
    if (!Number.isFinite(puntosNum) || (operation === 'set' && puntosNum < 0)) {
      await t.rollback();
      return res.status(400).json({ error: "Cantidad de puntos inválida" });
    }
    
    if (!motivo || String(motivo).trim() === "") {
      await t.rollback();
      return res.status(400).json({ error: "Motivo es requerido" });
    }

    const usuario = await Usuario.findByPk(id, { transaction: t });
    if (!usuario) {
      await t.rollback();
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const puntosAnteriores = usuario.puntos;
    let puntosNuevos, cambio;
    
    if (operation === 'add') {
      // Sumar o restar puntos
      cambio = puntosNum;
      puntosNuevos = Math.max(0, puntosAnteriores + puntosNum); // No permitir puntos negativos
    } else {
      // Establecer puntos directamente
      puntosNuevos = puntosNum;
      cambio = puntosNum - puntosAnteriores;
    }

    await usuario.update({ puntos: puntosNuevos }, { transaction: t });

    await HistorialPunto.create(
      {
        usuario_id: usuario.id,
        puntos: cambio, // La cantidad del cambio (positivo o negativo)
        cambio, // Campo legacy para compatibilidad
        tipo: cambio > 0 ? "ganado" : cambio < 0 ? "gastado" : "ajuste",
        concepto: `Ajuste de puntos [${operation === 'add' ? 'SUMA/RESTA' : 'ESTABLECER'}]: ${motivo} (Admin: ${adminNickname})`,
        motivo: `${motivo} (Admin: ${adminNickname})`, // Campo legacy para compatibilidad
      },
      { transaction: t },
    );

    await t.commit();

    res.json({
      message: "Puntos actualizados correctamente",
      usuario: {
        id: usuario.id,
        nickname: usuario.nickname,
        puntosAnteriores,
        puntosNuevos,
        cambio,
      },
      operation, // Informar qué operación se realizó
      motivo,
      administrador: adminNickname,
    });
  } catch (error) {
    await t.rollback();
    logger.error("Error al actualizar puntos:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", message: error.message });
  }
};

/**
 * 🔍 DEBUG: Verificar permisos del usuario current
 */
exports.debugPermisos = async (req, res) => {
  try {
    const { Rol, Permiso, RolPermiso } = require("../models");

    // Obtener información completa del usuario
    const userWithRole = await Usuario.findByPk(req.user.id, {
      include: [
        {
          model: Rol,
          include: [
            {
              model: Permiso,
              through: { attributes: [] }, // Excluir tabla intermedia
            },
          ],
        },
      ],
    });

    if (!userWithRole) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const permisos = userWithRole.Rol?.Permisos?.map((p) => p.nombre) || [];

    res.json({
      usuario: {
        id: userWithRole.id,
        nickname: userWithRole.nickname,
        email: userWithRole.email,
        rol_id: userWithRole.rol_id,
        rol_nombre: userWithRole.Rol?.nombre,
        rol_descripcion: userWithRole.Rol?.descripcion,
      },
      permisos: permisos,
      permisos_detalle:
        userWithRole.Rol?.Permisos?.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
        })) || [],
      verificaciones: {
        puede_ver_historial_puntos: permisos.includes("ver_historial_puntos"),
        puede_canjear_productos: permisos.includes("canjear_productos"),
        puede_ver_canjes: permisos.includes("ver_canjes"),
        es_admin: userWithRole.rol_id >= 3,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("[Debug Permisos] Error:", error);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
};

/**
 * 🔍 DEBUG: Verificar estructura de roles y permisos en la BD (sin auth)
 */
exports.debugRolesPermisos = async (req, res) => {
  try {
    const { Rol, Permiso, RolPermiso, Usuario } = require("../models");

    // 1. Obtener todos los roles
    const roles = await Rol.findAll({
      include: [
        {
          model: Permiso,
          through: { attributes: [] },
        },
      ],
      order: [["id", "ASC"]],
    });

    // 2. Obtener todos los permisos
    const permisos = await Permiso.findAll({
      order: [["id", "ASC"]],
    });

    // 3. Obtener todas las relaciones rol-permiso
    const rolPermisos = await RolPermiso.findAll({
      order: [
        ["rol_id", "ASC"],
        ["permiso_id", "ASC"],
      ],
    });

    // 4. Estadísticas de usuarios por rol
    const usuariosPorRol = await Usuario.findAll({
      attributes: [
        "rol_id",
        [
          Usuario.sequelize.fn("COUNT", Usuario.sequelize.col("id")),
          "total_usuarios",
        ],
      ],
      group: ["rol_id"],
      order: [["rol_id", "ASC"]],
    });

    // 5. Verificar específicamente el permiso 'ver_historial_puntos'
    const permisoHistorial = await Permiso.findOne({
      where: { nombre: "ver_historial_puntos" },
    });

    const rolesConPermisoHistorial = permisoHistorial
      ? await RolPermiso.findAll({
          where: { permiso_id: permisoHistorial.id },
          include: [{ model: Rol }],
        })
      : [];

    res.json({
      debug_estructura: {
        total_roles: roles.length,
        total_permisos: permisos.length,
        total_relaciones: rolPermisos.length,
      },
      roles: roles.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        descripcion: r.descripcion,
        permisos: r.Permisos?.map((p) => p.nombre) || [],
        total_permisos: r.Permisos?.length || 0,
      })),
      permisos: permisos.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
      })),
      usuarios_por_rol: usuariosPorRol.map((u) => ({
        rol_id: u.rol_id,
        total_usuarios: parseInt(u.dataValues.total_usuarios),
      })),
      permiso_historial_puntos: {
        existe: !!permisoHistorial,
        id: permisoHistorial?.id,
        nombre: permisoHistorial?.nombre,
        roles_que_lo_tienen: rolesConPermisoHistorial.map((rp) => ({
          rol_id: rp.rol_id,
          rol_nombre: rp.Rol?.nombre,
        })),
      },
      verificacion_rol_1: {
        rol_usuario_basico: roles.find((r) => r.id === 1),
        tiene_permiso_historial:
          roles
            .find((r) => r.id === 1)
            ?.Permisos?.some((p) => p.nombre === "ver_historial_puntos") ||
          false,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("[Debug Roles/Permisos] Error:", error);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
};

/**
 * 🔍 DEBUG: Verificar usuario específico por ID (sin auth)
 */
exports.debugUsuarioEspecifico = async (req, res) => {
  try {
    const { Rol, Permiso } = require("../models");
    const { usuarioId } = req.params;

    // Obtener usuario específico con rol y permisos
    const usuario = await Usuario.findByPk(usuarioId, {
      include: [
        {
          model: Rol,
          include: [
            {
              model: Permiso,
              through: { attributes: [] },
            },
          ],
        },
      ],
    });

    if (!usuario) {
      return res.status(404).json({
        error: "Usuario no encontrado",
        usuario_id: usuarioId,
      });
    }

    const permisos = usuario.Rol?.Permisos?.map((p) => p.nombre) || [];

    res.json({
      usuario: {
        id: usuario.id,
        nickname: usuario.nickname,
        email: usuario.email,
        rol_id: usuario.rol_id,
        user_id_ext: usuario.user_id_ext,
        creado: usuario.creado,
        actualizado: usuario.actualizado,
      },
      rol: {
        id: usuario.Rol?.id,
        nombre: usuario.Rol?.nombre,
        descripcion: usuario.Rol?.descripcion,
      },
      permisos: permisos,
      permisos_detalle:
        usuario.Rol?.Permisos?.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
        })) || [],
      verificaciones: {
        puede_ver_historial_puntos: permisos.includes("ver_historial_puntos"),
        puede_canjear_productos: permisos.includes("canjear_productos"),
        puede_ver_canjes: permisos.includes("ver_canjes"),
        es_admin: usuario.rol_id >= 3,
        puede_ver_propio_historial: true, // Siempre pueden ver su propio historial
        puede_ver_historial_otros: usuario.rol_id >= 3, // Solo admins pueden ver de otros
      },
      diagnostico: {
        problema_identificado: !permisos.includes("ver_historial_puntos")
          ? "Usuario NO tiene el permiso ver_historial_puntos"
          : "Usuario SÍ tiene el permiso ver_historial_puntos",
        logica_esperada:
          usuario.rol_id <= 2
            ? "Solo puede ver su propio historial (usuarios básicos)"
            : "Puede ver cualquier historial (administrador)",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("[Debug Usuario Específico] Error:", error);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
};

/**
 * 🔧 HOTFIX: Actualizar rol de usuario específico (temporal)
 */
exports.hotfixActualizarRol = async (req, res) => {
  try {
    const { usuarioId, nuevoRol } = req.params;

    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const rolAnterior = usuario.rol_id;
    await usuario.update({ rol_id: parseInt(nuevoRol) });

    res.json({
      success: true,
      mensaje: `Rol actualizado para ${usuario.nickname}`,
      usuario: {
        id: usuario.id,
        nickname: usuario.nickname,
        rol_anterior: rolAnterior,
        rol_nuevo: parseInt(nuevoRol),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("[Hotfix Rol] Error:", error);
    res.status(500).json({
      error: error.message,
    });
  }
};
