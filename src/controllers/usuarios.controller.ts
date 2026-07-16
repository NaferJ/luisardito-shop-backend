import type { Request, Response } from "express";
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
import { Op, WhereOptions, Transaction } from "sequelize";
import { extractAvatarUrl, getKickUserData } from "../utils/kickApi";
import logger from "../utils/logger";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/AppError";
import bcrypt from "bcryptjs";

/** Type for RolPermiso with eagerly-loaded Permiso. */
type RolPermisoWithPermiso = RolPermiso & {
  Permiso: Permiso;
};

/** Type for Rol with eagerly-loaded RolPermisos (with Permisos). */
type RolWithPermisos = Rol & {
  RolPermisos: RolPermisoWithPermiso[];
  Permisos?: Permiso[];
};

/** Type for Usuario with eagerly-loaded Rol (with nested associations). */
type UsuarioWithRol = Usuario & {
  Rol: RolWithPermisos | null;
};

/** Type for RolPermiso with eagerly-loaded Rol. */
type RolPermisoWithRol = RolPermiso & {
  Rol: Rol;
};

/** Type for Permiso with eagerly-loaded RolPermisos (with Rols). */
type PermisoWithRoles = Permiso & {
  RolPermisos: RolPermisoWithRol[];
};

/**
 * Helper function to enrich user info with Discord data
 * @param user - Usuario model instance
 * @returns Enriched Discord info
 */
async function enrichUserWithDiscordInfo(user: Usuario) {
  let discordInfo = null;
  const discordLink = await DiscordUserLink.findOne({
    where: { tienda_user_id: user.id },
  });

  if (discordLink) {
    discordInfo = {
      linked: true,
      id: discordLink.discord_user_id,
      username: discordLink.discord_username,
      discriminator: discordLink.discord_discriminator,
      avatar: discordLink.discord_avatar,
      linked_at: discordLink.created_at,
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
const me = asyncHandler(async (req: Request, res: Response) => {
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
const updateMe = asyncHandler(async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const allowedFields = new Set(["discord_username", "password"]);

    // Filter only allowed fields
    const filteredUpdates: Record<string, unknown> = {};
    Object.keys(updates).forEach((key) => {
      if (allowedFields.has(key) || key === "password") {
        filteredUpdates[key] = updates[key];
      }
    });

    if (filteredUpdates.password) {
      filteredUpdates.password_hash = await bcrypt.hash(
        filteredUpdates.password as string,
        10
      );
      delete filteredUpdates.password;
    }

    await req.user.update(filteredUpdates);

    res.json({
      message: "Profile updated",
      updated_fields: Object.keys(filteredUpdates),
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(err instanceof Error ? err.message : String(err), 400);
  }
});

// List all users with stats (admin by permission)
const listarUsuarios = asyncHandler(async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit
      ? Number.parseInt(req.query.limit as string)
      : undefined;
    const offset = req.query.offset
      ? Number.parseInt(req.query.offset as string)
      : undefined;
    const search = req.query.search
      ? (req.query.search as string).trim()
      : undefined;

    // Build where clause for search
    const whereClause: WhereOptions = {};
    if (search) {
      Object.assign(whereClause, {
        [Op.or]: [
          { nickname: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
        ],
      });
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
      usuarios.map(async (user) => {
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
  } catch (error) {
    logger.error("Error listing users:", error);
    throw new AppError("Internal server error", 500);
  }
});

// ============================================================================
// DEBUG ENDPOINTS
// ============================================================================

/**
 * Resolves subscriber info for a user from KickUserTracking.
 */
async function resolveSubscriberInfo(userIdExt: string | null): Promise<{
  is_subscriber: boolean;
  is_active: boolean;
  expires_at: Date | null;
}> {
  if (!userIdExt) {
    return { is_subscriber: false, is_active: false, expires_at: null };
  }

  const userTracking = await KickUserTracking.findOne({
    where: { kick_user_id: userIdExt },
  });

  if (!userTracking?.is_subscribed) {
    return { is_subscriber: false, is_active: false, expires_at: null };
  }

  const now = new Date();
  const expiresAt = userTracking.subscription_expires_at
    ? new Date(userTracking.subscription_expires_at)
    : null;
  return {
    is_subscriber: true,
    is_active: !expiresAt || expiresAt > now,
    expires_at: expiresAt,
  };
}

/**
 * DEBUG: Get complete info for a specific user
 */
const debugUsuario = asyncHandler(async (req: Request, res: Response) => {
  try {
    const usuarioId = req.params.usuarioId as string;

    const usuario = (await Usuario.findByPk(usuarioId, {
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
    })) as UsuarioWithRol | null;

    if (!usuario) {
      throw new AppError("User not found", 404);
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

    // Calculate subscriber info
    const subscriberInfo = await resolveSubscriberInfo(usuario.user_id_ext);

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
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("Error in user debug:", error);
    throw new AppError(
      error instanceof Error ? error.message : String(error),
      500
    );
  }
});

/**
 * HOTFIX: Update user role (temporary for fixes)
 */
const hotfixActualizarRol = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const usuarioId = req.params.usuarioId as string;
      const nuevoRolId = req.params.nuevoRolId as string;

      const usuario = await Usuario.findByPk(usuarioId);
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
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Error in role hotfix:", error);
      throw new AppError(
        error instanceof Error ? error.message : String(error),
        500
      );
    }
  }
);

/**
 * Fetches updated Kick user data by external ID.
 * Throws an AppError if the fetch fails or the user is not found.
 */
async function fetchKickUserData(
  userIdExt: string
): Promise<NonNullable<Awaited<ReturnType<typeof getKickUserData>>>> {
  let kickUserData: Awaited<ReturnType<typeof getKickUserData>>;
  try {
    kickUserData = await getKickUserData(userIdExt);
    logger.info(`[Sync Kick Info] Data fetched from Kick:`, {
      name: kickUserData?.name,
      user_id: kickUserData?.user_id,
      profile_picture: kickUserData?.profile_picture ? "present" : "absent",
    });
  } catch (kickError) {
    logger.error(
      "[Sync Kick Info] Error fetching Kick data:",
      kickError instanceof Error ? kickError.message : String(kickError)
    );
    throw new AppError(
      "Could not fetch updated Kick data",
      500,
      kickError instanceof Error ? kickError.message : String(kickError)
    );
  }

  if (!kickUserData) {
    throw new AppError(
      "User not found on Kick",
      404,
      "The user may have been deleted or is not public"
    );
  }

  return kickUserData;
}

// Sync Kick info (avatar, username, etc.)
const syncKickInfo = asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const user = await Usuario.findByPk(userId);

    if (!user?.user_id_ext) {
      throw new AppError(
        "User not connected to Kick",
        400,
        "You must connect your Kick account first"
      );
    }

    logger.info(
      `[Sync Kick Info] Syncing data for user ${user.nickname} (ID: ${userId})`
    );

    const kickUserData = await fetchKickUserData(user.user_id_ext);

    // Get Kick avatar
    const kickAvatarUrl = extractAvatarUrl(
      kickUserData as Record<string, unknown>
    );

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
      nickname: (kickUserData.name ||
        kickUserData.username ||
        user.nickname) as string,
      kick_data: updatedKickData as Record<string, unknown> & {
        is_subscriber?: boolean;
      },
    });

    logger.info(`[Sync Kick Info] User synced successfully`);

    // Return updated user
    const updatedUser = await Usuario.findByPk(userId);

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
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error(
      "[Sync Kick Info] General error:",
      error instanceof Error ? error.message : String(error)
    );
    throw new AppError(
      "Error syncing info",
      500,
      error instanceof Error ? error.message : String(error)
    );
  }
});

// Update user points (admin by permission)
const actualizarPuntos = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { puntos, motivo, operation = "set" } = req.body; // operation: 'add' | 'set'
  const adminNickname = req.user.nickname;

  const puntosNum = Number(puntos);

  const result = await Usuario.sequelize.transaction(async (t: Transaction) => {
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

    const usuario = await Usuario.findByPk(id, { transaction: t });
    if (!usuario) {
      throw new AppError("User not found", 404);
    }

    const puntosAnteriores = usuario.puntos;
    let puntosNuevos: number, cambio: number;

    if (operation === "add") {
      // Add or subtract points
      cambio = puntosNum;
      puntosNuevos = Math.max(0, puntosAnteriores + puntosNum); // Do not allow negative points
    } else {
      // Set points directly
      puntosNuevos = puntosNum;
      cambio = puntosNum - puntosAnteriores;
    }

    await usuario.update({ puntos: puntosNuevos }, { transaction: t });

    await HistorialPunto.create(
      {
        usuario_id: usuario.id,
        puntos: cambio, // The amount of the change (positive or negative)
        cambio, // Legacy field for compatibility
        tipo: (() => {
          if (cambio > 0) return "ganado";
          if (cambio < 0) return "gastado";
          return "ajuste";
        })(),
        concepto: `Points adjustment: ${motivo}`,
        motivo: motivo, // Legacy field for compatibility
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
const debugPermisos = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Get complete user info
    const userWithRole = (await Usuario.findByPk(req.user.id, {
      include: [
        {
          model: Rol,
          include: [
            {
              model: Permiso,
              through: { attributes: [] }, // Exclude intermediate table
            },
          ],
        },
      ],
    })) as UsuarioWithRol | null;

    if (!userWithRole) {
      throw new AppError("User not found", 404);
    }

    const permisos = userWithRole.Rol?.Permisos?.map((p) => p.nombre) || [];

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
    if (error instanceof AppError) throw error;
    logger.error("[Debug Permisos] Error:", error);
    throw new AppError(
      error instanceof Error ? error.message : String(error),
      500
    );
  }
});

/**
 * DEBUG: Check roles and permissions structure in DB (no auth)
 */
const debugRolesPermisos = asyncHandler(
  async (_req: Request, res: Response) => {
    try {
      // 1. Get all roles
      const roles = (await Rol.findAll({
        include: [
          {
            model: Permiso,
            through: { attributes: [] },
          },
        ],
        order: [["id", "ASC"]],
      })) as RolWithPermisos[];

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
      const permisoHistorial = (await Permiso.findOne({
        where: { nombre: "ver_historial_puntos" },
        include: [{ model: RolPermiso, include: [Rol] }],
      })) as (PermisoWithRoles & { RolPermisos: RolPermisoWithRol[] }) | null;

      const rolesConPermisoHistorial = permisoHistorial
        ? ((await RolPermiso.findAll({
            where: { permiso_id: permisoHistorial.id },
            include: [{ model: Rol }],
          })) as RolPermisoWithRol[])
        : [];

      res.json({
        debug_estructura: {
          total_roles: roles.length,
          total_permisos: permisos.length,
          total_relaciones: rolPermisos.length,
          total_usuarios_por_rol: usuariosPorRol.length,
        },
        roles: roles.map((rol) => ({
          id: rol.id,
          nombre: rol.nombre,
          descripcion: rol.descripcion,
          permisos: rol.Permisos.map((p) => p.nombre),
          total_permisos: rol.Permisos.length,
        })),
        permisos: permisos.map((permiso) => ({
          id: permiso.id,
          nombre: permiso.nombre,
          descripcion: permiso.descripcion,
        })),
        rol_permisos: rolPermisos.map((rp) => ({
          rol_id: rp.rol_id,
          permiso_id: rp.permiso_id,
        })),
        usuarios_por_rol: usuariosPorRol.map((u) => ({
          rol_id: u.rol_id,
          total_usuarios: Number.parseInt(
            (u.getDataValue as (key: string) => unknown)(
              "total_usuarios"
            ) as string
          ),
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
        roles_con_permiso_historial: rolesConPermisoHistorial.map((rp) => ({
          rol_id: rp.Rol.id,
          rol_nombre: rp.Rol.nombre,
        })),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error in roles and permissions debug (no auth):", error);
      throw new AppError(
        error instanceof Error ? error.message : String(error),
        500
      );
    }
  }
);

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
