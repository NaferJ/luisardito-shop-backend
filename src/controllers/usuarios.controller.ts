/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass
import {
  Usuario,
  HistorialPunto,
  sequelize,
  KickUserTracking,
  DiscordUserLink,
  Rol,
  Permiso,
  RolPermiso,
} from "../models";
import { Op } from "sequelize";
import { extractAvatarUrl, getKickUserData } from "../utils/kickApi";
import logger from "../utils/logger";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/AppError";
import bcrypt from "bcryptjs";

/**
 * Helper function to enrich user info with Discord data
 * @param {Object} user - Usuario model instance
 * @returns {Promise<Object>} Enriched Discord info
 */
async function enrichUserWithDiscordInfo(user: any) {
  let discordInfo = null;
  const discordLink: any = await DiscordUserLink.findOne({
    where: { tienda_user_id: user.id },
  });

  if (discordLink) {
    discordInfo = {
      linked: true,
      id: discordLink.discord_user_id,
      username: discordLink.discord_username,
      discriminator: discordLink.discord_discriminator,
      avatar: discordLink.discord_avatar,
      linked_at: discordLink.createdAt,
      display_name:
        discordLink.discord_discriminator &&
        discordLink.discord_discriminator !== "0"
          ? `${discordLink.discord_username}#${discordLink.discord_discriminator}`
          : discordLink.discord_username,
    };
  }

  return {
    discord_info: discordInfo,
    display_name: discordInfo?.display_name || user.nickname,
  };
}

// Show authenticated user data
const me = asyncHandler(async (req: any, res: any) => {
  const user = req.user;
  if (!user) {
    throw new AppError("User not authenticated", 401);
  }

  const {
    id,
    nickname,
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

  // Calculate subscriber info
  let subscriberStatus = {
    is_active: false,
    expires_soon: false,
  };

  // Get linked Discord info
  const { discord_info, display_name } = await enrichUserWithDiscordInfo(user);

  if (user.user_id_ext) {
    const userTracking: any = await KickUserTracking.findOne({
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
});

// Optional: edit profile
const updateMe = asyncHandler(async (req: any, res: any) => {
  try {
    const updates = req.body;
    const allowedFields = ["discord_username", "password"];

    // Filter only allowed fields
    const filteredUpdates: any = {};
    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key) || key === "password") {
        filteredUpdates[key] = updates[key];
      }
    });

    if (filteredUpdates.password) {
      filteredUpdates.password_hash = await bcrypt.hash(
        filteredUpdates.password,
        10
      );
      delete filteredUpdates.password;
    }

    await req.user.update(filteredUpdates);

    res.json({
      message: "Profile updated",
      updated_fields: Object.keys(filteredUpdates),
    });
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError(err.message, 400);
  }
});

// List all users with stats (admin by permission)
const listarUsuarios = asyncHandler(async (req: any, res: any) => {
  try {
    const limit = req.query.limit
      ? Number.parseInt(req.query.limit)
      : undefined;
    const offset = req.query.offset
      ? Number.parseInt(req.query.offset)
      : undefined;
    const search = req.query.search ? req.query.search.trim() : undefined;

    // Build where clause for search
    const whereClause: any = {};
    if (search) {
      whereClause[Op.or] = [
        { nickname: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const usuarios = await Usuario.findAll({
      where: whereClause,
      attributes: [
        "id",
        "nickname",
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

    // Enrich data with additional info
    const enrichedUsers = await Promise.all(
      usuarios.map(async (user: any) => {
        const userData = user.toJSON();
        const userInstance = Usuario.build(userData);

        // Get linked Discord info
        const { discord_info, display_name } =
          await enrichUserWithDiscordInfo(userInstance);

        // Calculate subscriber info
        let subscriberStatus = {
          is_active: false,
          expires_soon: false,
        };

        if (userData.user_id_ext) {
          const userTracking: any = await KickUserTracking.findOne({
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
          kick_data: userData.kick_data,
          display_name,
          discord_info,
          vip_status: {
            is_active: userInstance.isVipActive(),
            is_permanent: userData.is_vip && !userData.vip_expires_at,
            expires_soon:
              userData.vip_expires_at &&
              new Date(userData.vip_expires_at) <=
                new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
          subscriber_status: subscriberStatus,
          migration_status: {
            can_migrate: userInstance.canMigrateBotrix(),
            points_migrated: userData.botrix_points_migrated || 0,
          },
          user_type: userInstance.getUserType(),
        };
      })
    );

    res.json(enrichedUsers);
  } catch (error: any) {
    logger.error("Error listing users:", error);
    throw new AppError("Internal server error", 500);
  }
});

// ============================================================================
// DEBUG ENDPOINTS
// ============================================================================

/**
 * DEBUG: Get complete info for a specific user
 */
const debugUsuario = asyncHandler(async (req: any, res: any) => {
  try {
    const { usuarioId } = req.params;

    const usuario: any = await Usuario.findByPk(usuarioId, {
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
      throw new AppError("User not found", 404);
    }

    const permisos =
      usuario.Rol?.RolPermisos?.map((rp: any) => rp.Permiso.nombre) || [];
    const permisosDetalle =
      usuario.Rol?.RolPermisos?.map((rp: any) => ({
        id: rp.Permiso.id,
        nombre: rp.Permiso.nombre,
        descripcion: rp.Permiso.descripcion,
      })) || [];

    const userInstance = Usuario.build(usuario.toJSON());

    // Calculate subscriber info
    let subscriberInfo = {
      is_subscriber: false,
      is_active: false,
      expires_at: null,
    };

    if (usuario.user_id_ext) {
      const userTracking: any = await KickUserTracking.findOne({
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
          ? "User DOES have the ver_historial_puntos permission"
          : "User DOES NOT have the ver_historial_puntos permission",
        logica_esperada:
          usuario.rol_id <= 2
            ? "Can only view own history (basic users)"
            : "Can view any user history (admin)",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error("Error in user debug:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * HOTFIX: Update user role (temporary for fixes)
 */
const hotfixActualizarRol = asyncHandler(async (req: any, res: any) => {
  try {
    const { usuarioId, nuevoRolId } = req.params;

    const usuario: any = await Usuario.findByPk(usuarioId);
    if (!usuario) {
      throw new AppError("User not found", 404);
    }

    const rolAnterior = usuario.rol_id;
    await usuario.update({ rol_id: Number.parseInt(nuevoRolId) });

    res.json({
      success: true,
      mensaje: `Role updated for ${usuario.nickname}`,
      usuario: {
        id: usuario.id,
        nickname: usuario.nickname,
        rol_anterior: rolAnterior,
        rol_nuevo: Number.parseInt(nuevoRolId),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error("Error in role hotfix:", error);
    throw new AppError(error.message, 500);
  }
});

// Sync Kick info (avatar, username, etc.)
const syncKickInfo = asyncHandler(async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const user: any = await Usuario.findByPk(userId);

    if (!user || !user.user_id_ext) {
      throw new AppError(
        "User not connected to Kick",
        400,
        "You must connect your Kick account first"
      );
    }

    logger.info(
      `[Sync Kick Info] Syncing data for user ${user.nickname} (ID: ${userId})`
    );

    // Get updated Kick data using the external ID
    let kickUserData: any;
    try {
      kickUserData = await getKickUserData(user.user_id_ext);
      logger.info(`[Sync Kick Info] Data fetched from Kick:`, {
        name: kickUserData?.name,
        user_id: kickUserData?.user_id,
        profile_picture: kickUserData?.profile_picture ? "present" : "absent",
      });
    } catch (kickError: any) {
      logger.error(
        "[Sync Kick Info] Error fetching Kick data:",
        kickError.message
      );
      throw new AppError(
        "Could not fetch updated Kick data",
        500,
        kickError.message
      );
    }

    if (!kickUserData) {
      throw new AppError(
        "User not found on Kick",
        404,
        "The user may have been deleted or is not public"
      );
    }

    // Get Kick avatar
    const kickAvatarUrl = extractAvatarUrl(kickUserData);

    if (!kickAvatarUrl) {
      logger.info("[Sync Kick Info] No avatar found in Kick data");
    }

    // Update user with synced data
    const updatedKickData = {
      ...user.kick_data,
      username: kickUserData.name || kickUserData.username,
      avatar_url: kickAvatarUrl || user.kick_data?.avatar_url || null,
      user_id: kickUserData.user_id || kickUserData.id,
      last_sync: new Date().toISOString(),
    };

    await user.update({
      nickname: kickUserData.name || kickUserData.username || user.nickname,
      kick_data: updatedKickData,
    });

    logger.info(`[Sync Kick Info] User synced successfully`);

    // Return updated user
    const updatedUser: any = await Usuario.findByPk(userId);

    res.json({
      message: "Info synced successfully",
      user: {
        id: updatedUser.id,
        nickname: updatedUser.nickname,
        puntos: updatedUser.puntos,
        rol_id: updatedUser.rol_id,
        kick_data: updatedUser.kick_data,
        creado: updatedUser.creado,
        actualizado: updatedUser.actualizado,
      },
      changes: {
        avatar_updated: kickAvatarUrl !== user.kick_data?.avatar_url,
        username_updated:
          (kickUserData.name || kickUserData.username) !== user.nickname,
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error("[Sync Kick Info] General error:", error.message);
    throw new AppError("Error syncing info", 500, error.message);
  }
});

// Update user points (admin by permission)
const actualizarPuntos = asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const { puntos, motivo, operation = "set" } = req.body; // operation: 'add' | 'set'
  const adminNickname = req.user.nickname;

  const puntosNum = Number(puntos);

  const result = await Usuario.sequelize.transaction(async (t: any) => {
    // Validate operation
    if (!["add", "set"].includes(operation)) {
      throw new AppError("Operation must be 'add' or 'set'", 400);
    }

    // For 'add', allow negatives (subtract); for 'set', do not allow negatives
    if (!Number.isFinite(puntosNum) || (operation === "set" && puntosNum < 0)) {
      throw new AppError("Invalid points amount", 400);
    }

    if (!motivo || String(motivo).trim() === "") {
      throw new AppError("Reason is required", 400);
    }

    const usuario: any = await Usuario.findByPk(id, { transaction: t });
    if (!usuario) {
      throw new AppError("User not found", 404);
    }

    const puntosAnteriores = usuario.puntos;
    let puntosNuevos: any, cambio: any;

    if (operation === "add") {
      // Add or subtract points
      cambio = puntosNum;
      puntosNuevos = Math.max(0, puntosAnteriores + puntosNum); // No permitir puntos negativos
    } else {
      // Set points directly
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
        concepto: `Points adjustment: ${motivo}`,
        motivo: motivo, // Campo legacy para compatibilidad
      },
      { transaction: t }
    );

    return {
      message: "Points updated successfully",
      usuario: {
        id: usuario.id,
        nickname: usuario.nickname,
        puntosAnteriores,
        puntosNuevos,
        cambio,
      },
      operation, // Report which operation was performed
      motivo,
      administrador: adminNickname,
    };
  });

  res.json(result);
});

/**
 * DEBUG: Check current user permissions
 */
const debugPermisos = asyncHandler(async (req: any, res: any) => {
  try {
    // Get complete user info
    const userWithRole: any = await Usuario.findByPk(req.user.id, {
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
      throw new AppError("User not found", 404);
    }

    const permisos =
      userWithRole.Rol?.Permisos?.map((p: any) => p.nombre) || [];

    res.json({
      usuario: {
        id: userWithRole.id,
        nickname: userWithRole.nickname,
        rol_id: userWithRole.rol_id,
        rol_nombre: userWithRole.Rol?.nombre,
        rol_descripcion: userWithRole.Rol?.descripcion,
      },
      permisos: permisos,
      permisos_detalle:
        userWithRole.Rol?.Permisos?.map((p: any) => ({
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
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error("[Debug Permisos] Error:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * DEBUG: Check roles and permissions structure in DB (no auth)
 */
const debugRolesPermisos = asyncHandler(async (req: any, res: any) => {
  try {
    // 1. Get all roles
    const roles = await Rol.findAll({
      include: [
        {
          model: Permiso,
          through: { attributes: [] },
        },
      ],
      order: [["id", "ASC"]],
    });

    // 2. Get all permissions
    const permisos = await Permiso.findAll({
      order: [["id", "ASC"]],
    });

    // 3. Get all role-permission relations
    const rolPermisos = await RolPermiso.findAll({
      order: [
        ["rol_id", "ASC"],
        ["permiso_id", "ASC"],
      ],
    });

    // 4. User stats by role
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

    // 5. Specifically check the 'ver_historial_puntos' permission
    const permisoHistorial: any = await Permiso.findOne({
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
        total_usuarios_por_rol: usuariosPorRol.length,
      },
      roles: roles.map((rol: any) => ({
        id: rol.id,
        nombre: rol.nombre,
        descripcion: rol.descripcion,
        permisos: rol.Permisos.map((p: any) => p.nombre),
        total_permisos: rol.Permisos.length,
      })),
      permisos: permisos.map((permiso: any) => ({
        id: permiso.id,
        nombre: permiso.nombre,
        descripcion: permiso.descripcion,
      })),
      rol_permisos: rolPermisos.map((rp: any) => ({
        rol_id: rp.rol_id,
        permiso_id: rp.permiso_id,
      })),
      usuarios_por_rol: usuariosPorRol.map((u: any) => ({
        rol_id: u.rol_id,
        total_usuarios: Number.parseInt(u.getDataValue("total_usuarios")),
      })),
      permiso_historial_puntos: permisoHistorial
        ? {
            existe: true,
            id: permisoHistorial.id,
            nombre: permisoHistorial.nombre,
            roles_que_lo_tienen: permisoHistorial.RolPermisos.map(
              (rp: any) => ({
                rol_id: rp.Rol.id,
                rol_nombre: rp.Rol.nombre,
              })
            ),
          }
        : { existe: false },
      roles_con_permiso_historial: rolesConPermisoHistorial.map((rp: any) => ({
        rol_id: rp.Rol.id,
        rol_nombre: rp.Rol.nombre,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error("Error in roles and permissions debug (no auth):", error);
    throw new AppError(error.message, 500);
  }
});

export = {
  me,
  updateMe,
  listarUsuarios,
  debugUsuario,
  hotfixActualizarRol,
  syncKickInfo,
  actualizarPuntos,
  debugPermisos,
  debugRolesPermisos,
};
