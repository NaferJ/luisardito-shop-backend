import type { Request, Response } from "express";
import {
  Canje,
  Producto,
  Usuario,
  HistorialPunto,
  KickUserTracking,
  DiscordUserLink,
} from "../models";
import { Op, WhereOptions, Transaction } from "sequelize";
import VipService from "../services/vip.service";
import KickBotService from "../services/kickBot.service";
import promocionService from "../services/promocion.service";
import NotificacionService from "../services/notificacion.service";
import logger from "../utils/logger";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/AppError";

/** Type for Canje with eagerly-loaded associations. */
type CanjeWithAssociations = Canje & {
  Usuario?: Usuario | null;
  Producto?: Producto | null;
};

/**
 * Helper to enrich user info with Discord data
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

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

async function enrichUsuarioWithStatus(
  usuario: Usuario,
  now: Date,
  includeDiscord = false
) {
  const dataValues = usuario.dataValues as Record<string, unknown>;

  if (includeDiscord) {
    const { discord_info, display_name } =
      await enrichUserWithDiscordInfo(usuario);
    dataValues.display_name = display_name;
    dataValues.discord_info = discord_info;
  }

  dataValues.vip_status = {
    is_active:
      usuario.is_vip &&
      (!usuario.vip_expires_at || new Date(usuario.vip_expires_at) > now),
    is_permanent: usuario.is_vip && !usuario.vip_expires_at,
    expires_soon:
      usuario.vip_expires_at &&
      new Date(usuario.vip_expires_at) <= new Date(Date.now() + SEVEN_DAYS_MS),
  };

  if (usuario.user_id_ext) {
    const userTracking = await KickUserTracking.findOne({
      where: { kick_user_id: usuario.user_id_ext },
    });

    let subscriberInfo = {
      is_active: false,
      expires_soon: false,
    };

    if (userTracking?.is_subscribed) {
      const expiresAt = userTracking.subscription_expires_at
        ? new Date(userTracking.subscription_expires_at)
        : null;
      subscriberInfo = {
        is_active: !expiresAt || expiresAt > now,
        expires_soon:
          expiresAt && expiresAt <= new Date(Date.now() + SEVEN_DAYS_MS),
      };
    }

    dataValues.subscriber_status = subscriberInfo;
  } else {
    dataValues.subscriber_status = {
      is_active: false,
      expires_soon: false,
    };
  }
}

const crear = asyncHandler(async (req: Request, res: Response) => {
  const { producto_id } = req.body;
  const usuarioId = req.user.id;

  const {
    canje,
    producto,
    precioFinal,
    infoDescuento,
    promocionAplicada,
    nickname,
  } = await Canje.sequelize.transaction(async (t: Transaction) => {
    const producto = await Producto.findByPk(producto_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (producto?.estado !== "publicado") {
      throw new AppError("Product not available", 404);
    }
    const stockActual = Number.isFinite(producto.stock) ? producto.stock : 0;
    if (stockActual <= 0) {
      throw new AppError("No stock available for this product", 400);
    }

    const usuario = await Usuario.findByPk(usuarioId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!usuario) {
      throw new AppError("User not found", 404);
    }

    // Calculate price with discount if there is a promotion
    const infoDescuento = await promocionService.calcularMejorDescuento(
      producto.id,
      producto.precio,
      usuarioId
    );

    const precioFinal = infoDescuento.precioFinal;
    const promocionAplicada = infoDescuento.promocion;

    if (usuario.puntos < precioFinal) {
      throw new AppError("Insufficient points", 400);
    }

    // 2) Create canje with historical price and promotion
    const canje = await Canje.create(
      {
        usuario_id: usuario.id,
        producto_id,
        precio_al_canje: precioFinal, // Save FINAL price (with discount) at canje time
      },
      { transaction: t }
    );

    // 3) Decrement product stock
    await producto.update({ stock: stockActual - 1 }, { transaction: t });

    // 4) Subtract points from the user
    const puntosNuevos = usuario.puntos - precioFinal;
    await usuario.update({ puntos: puntosNuevos }, { transaction: t });

    // 5) Record promotion usage if one was applied
    if (promocionAplicada) {
      await promocionService.aplicarPromocion(
        promocionAplicada.id,
        usuarioId,
        producto_id,
        canje.id,
        t // Pass the existing transaction
      );
    }

    // 6) Record points history
    const conceptoCanje = promocionAplicada
      ? `Product redemption: ${producto.nombre} (Promotion: ${promocionAplicada.titulo} - Savings: ${infoDescuento.descuento} pts)`
      : `Product redemption: ${producto.nombre}`;

    await HistorialPunto.create(
      {
        usuario_id: usuario.id,
        puntos: -precioFinal,
        cambio: -precioFinal,
        tipo: "gastado",
        concepto: conceptoCanje,
        motivo: conceptoCanje,
      },
      { transaction: t }
    );

    // 7) Create canje-created notification
    await NotificacionService.crearNotificacionCanjeCreado(
      usuario.id,
      {
        canje_id: canje.id,
        nombre_producto: producto.nombre,
        precio: precioFinal,
        promocion_aplicada: promocionAplicada
          ? {
              id: promocionAplicada.id,
              titulo: promocionAplicada.titulo,
              descuento: infoDescuento.descuento,
            }
          : null,
      },
      t
    );

    return {
      canje,
      producto,
      precioFinal,
      infoDescuento,
      promocionAplicada,
      nickname: usuario.nickname,
    };
  });

  // Send automatic message to Kick chat
  try {
    const mensajeDescuento = promocionAplicada
      ? ` with ${infoDescuento.porcentajeDescuento}% discount (${promocionAplicada.titulo})`
      : "";
    const mensaje = `${nickname} canjeo ${producto.nombre}${mensajeDescuento}.`;
    await KickBotService.sendMessage(mensaje);
    logger.info(`[Canje] Message sent to chat: "${mensaje}"`);
  } catch (botError) {
    logger.error(
      "[Canje] Error sending message to chat:",
      botError instanceof Error ? botError.message : String(botError)
    );
    // Do not fail the response if the bot message fails
  }

  res.status(201).json({
    ...canje.toJSON(),
    precio_original: producto.precio,
    precio_pagado: precioFinal,
    descuento_aplicado: infoDescuento.descuento,
    promocion: promocionAplicada
      ? {
          id: promocionAplicada.id,
          titulo: promocionAplicada.titulo,
          tipo: promocionAplicada.tipo_descuento,
          valor: promocionAplicada.valor_descuento,
        }
      : null,
  });
});

const listar = asyncHandler(async (req: Request, res: Response) => {
  // Route protected by permiso('gestionar_canjes'): return all canjes
  const search = req.query.search
    ? (req.query.search as string).trim()
    : undefined;
  const estado = req.query.estado
    ? (req.query.estado as string).trim()
    : undefined;

  // Build where clause
  const whereClause: WhereOptions = {};
  if (estado) {
    whereClause.estado = estado;
  }
  if (search) {
    // Search by user nickname
    (whereClause as Record<string, unknown>)["$Usuario.nickname$"] = {
      [Op.iLike]: `%${search}%`,
    };
  }

  const canjes = await Canje.findAll({
    where: whereClause,
    include: [Usuario, Producto],
    order: [["fecha", "DESC"]],
  });

  // Add VIP and subscriber info to each user
  const now = new Date();
  for (const canje of canjes) {
    const c = canje as CanjeWithAssociations;
    if (c.Usuario) {
      await enrichUsuarioWithStatus(c.Usuario, now, true);
    }
  }

  res.json(canjes);
});

// List only the authenticated user's canjes (for "My Canjes")
const listarMios = asyncHandler(async (req: Request, res: Response) => {
  const canjes = await Canje.findAll({
    where: { usuario_id: req.user.id },
    include: [Usuario, Producto],
    order: [["fecha", "DESC"]],
  });

  // Add VIP and subscriber info to the user (same user, for consistency)
  const now = new Date();
  for (const canje of canjes) {
    const c = canje as CanjeWithAssociations;
    if (c.Usuario) {
      await enrichUsuarioWithStatus(c.Usuario, now, false);
    }
  }

  res.json(canjes);
});

// List canjes for a specific user (admin/management view)
const listarPorUsuario = asyncHandler(async (req: Request, res: Response) => {
  const { usuarioId } = req.params;
  const id = Number(usuarioId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Invalid usuarioId", 400);
  }
  const canjes = await Canje.findAll({
    where: { usuario_id: id },
    include: [Usuario, Producto],
    order: [["fecha", "DESC"]],
  });

  // Add VIP and subscriber info to the user
  const now = new Date();
  for (const canje of canjes) {
    const c = canje as CanjeWithAssociations;
    if (c.Usuario) {
      await enrichUsuarioWithStatus(c.Usuario, now, true);
    }
  }

  res.json(canjes);
});

async function maybeGrantVip(canje: CanjeWithAssociations) {
  logger.info(
    `[VIP GRANT] VIP product delivered detected: ${canje.Producto.nombre}`
  );

  const now = new Date();
  const isAlreadyVip =
    canje.Usuario.is_vip &&
    (!canje.Usuario.vip_expires_at ||
      new Date(canje.Usuario.vip_expires_at) > now);

  if (!isAlreadyVip) {
    try {
      const vipConfig = {
        duration_days: null,
      };

      await VipService.grantVipFromCanje(canje.id, canje.usuario_id, vipConfig);
      logger.info(
        `[VIP GRANT] VIP granted to ${canje.Usuario.nickname} for canje #${canje.id}`
      );
    } catch (vipError) {
      logger.error(`[VIP GRANT] Error granting VIP:`, vipError);
    }
  } else {
    logger.warn(
      `[VIP GRANT] ${canje.Usuario.nickname} is already an active VIP, not granting again`
    );
  }
}

const actualizarEstado = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { estado } = req.body;
  const estadosPermitidos = ["pendiente", "entregado", "cancelado"];

  const result = await Canje.sequelize.transaction(async (t: Transaction) => {
    if (!estadosPermitidos.includes(estado)) {
      throw new AppError(
        `Invalid state. Allowed: ${estadosPermitidos.join(", ")}. To return use PUT /api/canjes/:id/devolver.`,
        400
      );
    }

    const canje = (await Canje.findByPk(id, {
      include: [
        { model: Usuario, attributes: ["id", "nickname", "is_vip"] },
        { model: Producto, attributes: ["id", "nombre", "descripcion"] },
      ],
      transaction: t,
    })) as CanjeWithAssociations | null;

    if (!canje) {
      throw new AppError("Not found", 404);
    }

    // Update canje state
    await canje.update({ estado }, { transaction: t });

    // Create notifications based on the new state
    if (estado === "entregado") {
      await NotificacionService.crearNotificacionCanjeEntregado(
        canje.usuario_id,
        {
          canje_id: canje.id,
          nombre_producto: canje.Producto.nombre,
        },
        t
      );
    } else if (estado === "cancelado") {
      await NotificacionService.crearNotificacionCanjeCancelado(
        canje.usuario_id,
        {
          canje_id: canje.id,
          nombre_producto: canje.Producto.nombre,
          motivo: "Cancelled by administrator",
        },
        t
      );
    }

    // VIP FEATURE: If marked as delivered and the product contains "VIP"
    if (
      estado === "entregado" &&
      canje.Producto?.nombre.toLowerCase().includes("vip")
    ) {
      await maybeGrantVip(canje);
    }

    // Check if VIP should be granted for the response
    const shouldGrantVip =
      estado === "entregado" &&
      canje.Producto?.nombre.toLowerCase().includes("vip");

    const isAlreadyVip =
      canje.Usuario?.is_vip &&
      (!canje.Usuario?.vip_expires_at ||
        new Date(canje.Usuario.vip_expires_at) > new Date());

    return {
      message: "State updated",
      id: canje.id,
      estado: canje.estado,
      vip_info: shouldGrantVip
        ? {
            product_grants_vip: true,
            user_already_vip: isAlreadyVip,
            vip_granted: shouldGrantVip && !isAlreadyVip,
          }
        : null,
    };
  });

  res.json(result);
});

// Return a canje: mark as 'devuelto', refund points and restock
const devolverCanje = asyncHandler(async (req: Request, res: Response) => {
  const result = await Canje.sequelize.transaction(async (t: Transaction) => {
    const id = req.params.id as string;
    const { motivo } = req.body;
    const adminNickname = req.user.nickname;

    if (!motivo || String(motivo).trim() === "") {
      throw new AppError("Return reason is required", 400);
    }

    const canje = (await Canje.findByPk(id, {
      include: [Usuario, Producto],
      transaction: t,
      lock: t.LOCK.UPDATE,
    })) as CanjeWithAssociations | null;
    if (!canje) {
      throw new AppError("Canje not found", 404);
    }

    if (canje.estado === "devuelto") {
      throw new AppError("Canje is already returned", 400);
    }

    if (!["pendiente", "entregado"].includes(canje.estado)) {
      throw new AppError(
        "Only pending or delivered canjes can be returned",
        400
      );
    }

    const usuario = canje.Usuario;
    const producto = canje.Producto;

    // Use the historical canje price, with fallback to the current product price
    const puntosADevolver = canje.precio_al_canje || producto.precio;
    const puntosAnteriores = usuario.puntos;

    // 1. Mark canje as returned
    await canje.update({ estado: "devuelto" }, { transaction: t });

    // 2. Refund points to the user
    const puntosNuevos = puntosAnteriores + puntosADevolver;
    await usuario.update({ puntos: puntosNuevos }, { transaction: t });

    // 3. Record history
    await HistorialPunto.create(
      {
        usuario_id: usuario.id,
        puntos: puntosADevolver, // Positive amount because points are refunded
        cambio: puntosADevolver, // Legacy field for compatibility
        tipo: "ganado",
        concepto: `Canje return: ${producto.nombre} - ${motivo} (Admin: ${adminNickname})`,
        motivo: `Canje return: ${producto.nombre} - ${motivo} (Admin: ${adminNickname})`, // Legacy field for compatibility
      },
      { transaction: t }
    );

    // 4. Restock the product (if applicable)
    const stockActual = Number.isFinite(producto.stock) ? producto.stock : 0;
    await producto.update({ stock: stockActual + 1 }, { transaction: t });

    // 5) Create canje-returned notification
    await NotificacionService.crearNotificacionCanjeDevuelto(
      usuario.id,
      {
        canje_id: canje.id,
        nombre_producto: producto.nombre,
        puntos_devueltos: puntosADevolver,
        motivo: motivo,
      },
      t
    );

    return {
      message: "Canje returned successfully",
      canje: { id: canje.id, estado: "devuelto" },
      usuario: {
        id: usuario.id,
        nickname: usuario.nickname,
        puntosAnteriores,
        puntosNuevos,
      },
      producto: {
        id: producto.id,
        nombre: producto.nombre,
        stockNuevo: stockActual + 1,
      },
    };
  });

  res.json(result);
});

export {
  crear,
  listar,
  listarMios,
  listarPorUsuario,
  actualizarEstado,
  devolverCanje,
};

export default {
  crear,
  listar,
  listarMios,
  listarPorUsuario,
  actualizarEstado,
  devolverCanje,
};
