import type { Request, Response } from "express";
import {
  Producto,
  Promocion,
  PromocionProducto,
  Canje,
  Usuario,
  DiscordUserLink,
  sequelize,
} from "../models";
import { Op, WhereOptions } from "sequelize";
import promocionService from "../services/promocion.service";
import logger from "../utils/logger";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/AppError";

const CANJES_COUNT_ATTRIBUTES: {
  include: Array<[ReturnType<typeof sequelize.literal>, string]>;
} = {
  include: [
    [
      sequelize.literal(
        "(SELECT COUNT(*) FROM canjes c WHERE c.producto_id = Producto.id AND c.estado != 'devuelto')"
      ),
      "canjes_count",
    ],
  ],
};

interface UltimoCanjeKickData {
  avatar_url: string | null;
  username: string | null;
}

interface UltimoCanje {
  usuario_id: number;
  nickname: string;
  display_name: string;
  avatar: string | null;
  kick_data: UltimoCanjeKickData | null;
  fecha: Date;
}

/** Canje with its Usuario association eagerly loaded. */
type CanjeWithUsuario = Canje & { Usuario?: Usuario | null };

interface DiscordLinkRow {
  tienda_user_id: number;
  discord_username: string | null;
  discord_discriminator: string | null;
  discord_avatar: string | null;
}

/**
 * Resolves the display name for a redeemer, preferring Discord info when linked.
 */
function resolveRedeemerDisplayName(
  discord: DiscordLinkRow | undefined,
  nickname: string
): string {
  if (!discord) return nickname;
  if (discord.discord_discriminator && discord.discord_discriminator !== "0") {
    return `${discord.discord_username}#${discord.discord_discriminator}`;
  }
  return discord.discord_username as string;
}

/**
 * Fetches the most recent non-returned/non-cancelled redemption for each of the
 * given product IDs, in two queries (one for canjes + usuarios, one for the
 * redeemers' Discord links). Returns a map of producto_id -> ultimo_canje.
 *
 * Products with no redemptions are absent from the map; callers should default
 * to null.
 */
async function getLastRedeemersByProduct(
  productIds: number[]
): Promise<Map<number, UltimoCanje>> {
  const result = new Map<number, UltimoCanje>();
  if (productIds.length === 0) return result;

  const canjes = (await Canje.findAll({
    where: {
      producto_id: { [Op.in]: productIds },
      estado: { [Op.in]: ["pendiente", "entregado"] },
    },
    include: [{ model: Usuario, attributes: ["id", "nickname", "kick_data"] }],
    order: [["fecha", "DESC"]],
  })) as unknown as CanjeWithUsuario[];

  // canjes are ordered by fecha DESC; keep the first canje per product.
  const firstCanjeByProduct = new Map<number, CanjeWithUsuario>();
  const redeemerIds = new Set<number>();
  for (const canje of canjes) {
    if (firstCanjeByProduct.has(canje.producto_id)) continue;
    firstCanjeByProduct.set(canje.producto_id, canje);
    if (canje.Usuario) redeemerIds.add(canje.Usuario.id);
  }

  if (redeemerIds.size === 0) return result;

  const discordLinks = await DiscordUserLink.findAll({
    where: { tienda_user_id: { [Op.in]: [...redeemerIds] } },
    attributes: [
      "tienda_user_id",
      "discord_username",
      "discord_discriminator",
      "discord_avatar",
    ],
    raw: true,
  });
  const discordByUser = new Map<number, DiscordLinkRow>();
  for (const link of discordLinks) {
    discordByUser.set(link.tienda_user_id, link);
  }

  for (const [productoId, canje] of firstCanjeByProduct) {
    const usuario = canje.Usuario;
    if (!usuario) continue;

    const discord = discordByUser.get(usuario.id);
    const kickData = usuario.kick_data as {
      avatar_url?: string;
      username?: string;
    } | null;
    const kickAvatar = kickData?.avatar_url ?? null;
    const kickUsername = kickData?.username ?? null;

    const displayName = resolveRedeemerDisplayName(discord, usuario.nickname);
    const avatar = discord?.discord_avatar || kickAvatar;

    result.set(productoId, {
      usuario_id: usuario.id,
      nickname: usuario.nickname,
      display_name: displayName,
      avatar,
      kick_data: {
        avatar_url: kickAvatar,
        username: kickUsername,
      },
      fecha: canje.fecha,
    });
  }

  return result;
}

function parseSortOrder(sortParam: unknown): Array<[string, string]> {
  const sort = typeof sortParam === "string" ? sortParam.toLowerCase() : "";
  switch (sort) {
    case "price_asc":
    case "precio_asc":
      return [["precio", "ASC"]];
    case "price_desc":
    case "precio_desc":
    default:
      return [["precio", "DESC"]];
  }
}

async function enrichProductoWithDiscounts(
  producto: Producto,
  usuarioId: number | null,
  ultimoCanje: UltimoCanje | null = null
) {
  const infoDescuento = await promocionService.calcularMejorDescuento(
    producto.id,
    producto.precio,
    usuarioId
  );

  const promocionesActivas =
    await promocionService.obtenerPromocionesActivasProducto(
      producto.id,
      usuarioId
    );

  return {
    ...producto.toJSON(),
    descuento: infoDescuento,
    promociones_activas: promocionesActivas.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      titulo: p.titulo,
      tipo_descuento: p.tipo_descuento,
      valor_descuento: p.valor_descuento,
    })),
    promocion_id: infoDescuento.promocion ? infoDescuento.promocion.id : null,
    ultimo_canje: ultimoCanje,
  };
}

async function buildProductoDetailResponse(
  producto: Producto,
  usuarioId: number | null,
  ultimoCanje: UltimoCanje | null = null
) {
  const infoDescuento = await promocionService.calcularMejorDescuento(
    producto.id,
    producto.precio,
    usuarioId
  );

  const promocionesActivas =
    await promocionService.obtenerPromocionesActivasProducto(
      producto.id,
      usuarioId
    );

  return {
    ...producto.toJSON(),
    descuento: infoDescuento,
    promociones_activas: promocionesActivas.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      titulo: p.titulo,
      descripcion: p.descripcion,
      tipo_descuento: p.tipo_descuento,
      valor_descuento: p.valor_descuento,
      fecha_fin: p.fecha_fin,
      metadata_visual: p.metadata_visual,
      requiere_codigo: p.requiere_codigo,
    })),
    promocion_id: infoDescuento.promocion ? infoDescuento.promocion.id : null,
    ultimo_canje: ultimoCanje,
  };
}

// List all (with price sort; default DESC). For public, usually only published.
const listar = asyncHandler(async (req: Request, res: Response) => {
  const where: WhereOptions = {};

  if (!req.user || req.user.rol_id <= 2) {
    // Non-logged-in or basic users (role 1-2) only see published products
    where.estado = "publicado";
  }

  const order = parseSortOrder(req.query.sort);

  const productos = await Producto.findAll({
    where,
    order,
    attributes: CANJES_COUNT_ATTRIBUTES,
  });

  // Add discount info and last redeemer to each product
  const usuarioId = req.user ? req.user.id : null;
  const lastRedeemers = await getLastRedeemersByProduct(
    productos.map((p) => p.id)
  );
  const productosConDescuentos = await Promise.all(
    productos.map((producto) =>
      enrichProductoWithDiscounts(
        producto,
        usuarioId,
        lastRedeemers.get(producto.id) ?? null
      )
    )
  );

  res.json(productosConDescuentos);
});

const obtener = asyncHandler(async (req: Request, res: Response) => {
  const producto = await Producto.findByPk(req.params.id as string, {
    attributes: CANJES_COUNT_ATTRIBUTES,
  });
  if (!producto) throw new AppError("Not found", 404);

  const usuarioId = req.user ? req.user.id : null;
  const lastRedeemers = await getLastRedeemersByProduct([producto.id]);
  res.json(
    await buildProductoDetailResponse(
      producto,
      usuarioId,
      lastRedeemers.get(producto.id) ?? null
    )
  );
});

const obtenerPorSlug = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const where: WhereOptions = { slug };

  if (!req.user || req.user.rol_id <= 2) {
    where.estado = "publicado";
  } else {
    where.estado = { [Op.in]: ["publicado", "borrador"] };
  }

  const producto = await Producto.findOne({
    where,
    attributes: CANJES_COUNT_ATTRIBUTES,
  });

  if (!producto) throw new AppError("Product not found", 404);

  const usuarioId = req.user ? req.user.id : null;
  const lastRedeemers = await getLastRedeemersByProduct([producto.id]);
  res.json(
    await buildProductoDetailResponse(
      producto,
      usuarioId,
      lastRedeemers.get(producto.id) ?? null
    )
  );
});

const crear = asyncHandler(async (req: Request, res: Response) => {
  try {
    // imagen_width / imagen_height are accepted from the request body.
    // The frontend (which uploads to Cloudinary) is responsible for
    // sending the real dimensions from the upload response.
    const producto = await Producto.create(req.body);
    res.status(201).json(producto);
  } catch (err) {
    throw new AppError(err instanceof Error ? err.message : String(err), 400);
  }
});

const editar = asyncHandler(async (req: Request, res: Response) => {
  const producto = await Producto.findByPk(req.params.id as string);
  if (!producto) throw new AppError("Not found", 404);
  try {
    const body = { ...req.body };

    // If the image is cleared, reset dimensions too so stale values
    // don't linger. When a new image_url is provided, the frontend
    // is expected to also send imagen_width / imagen_height.
    if (Object.hasOwn(body, "imagen_url")) {
      if (!body.imagen_url) {
        body.imagen_width = null;
        body.imagen_height = null;
      }
    }

    await producto.update(body);
    res.json(producto);
  } catch (err) {
    throw new AppError(err instanceof Error ? err.message : String(err), 400);
  }
});

const eliminar = asyncHandler(async (req: Request, res: Response) => {
  const producto = await Producto.findByPk(req.params.id as string);
  if (!producto) throw new AppError("Not found", 404);
  await producto.destroy();
  res.json({ message: "Product deleted" });
});

/**
 * Update product promotions
 */
const actualizarPromociones = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { promocion_ids } = req.body; // Array of promotion IDs to assign

      if (!Array.isArray(promocion_ids)) {
        throw new AppError("promocion_ids must be an array", 400);
      }

      const producto = await Producto.findByPk(id);
      if (!producto) {
        throw new AppError("Product not found", 404);
      }

      // For each selected promotion, update its product list
      // For each selected promotion, update its product list

      const todasPromociones = await Promocion.findAll({
        attributes: ["id"],
      });

      for (const promo of todasPromociones) {
        const debeEstar = promocion_ids.includes(promo.id);
        const estaAsignado = await PromocionProducto.findOne({
          where: {
            promocion_id: promo.id,
            producto_id: id as unknown as number,
          },
        });

        if (debeEstar && !estaAsignado) {
          // Add relation
          await PromocionProducto.create({
            promocion_id: promo.id,
            producto_id: id as unknown as number,
          });
        } else if (!debeEstar && estaAsignado) {
          // Remove relation
          await estaAsignado.destroy();
        }
      }

      res.json({
        message: "Promotions updated successfully",
        producto_id: id,
        promociones_asignadas: promocion_ids,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Error updating product promotions:", error);
      throw new AppError("Error updating promotions", 500);
    }
  }
);

// Debug endpoint to list all products without filters
const debugListar = asyncHandler(async (_req: Request, res: Response) => {
  const productos = await Producto.findAll({
    order: [["id", "ASC"]],
    attributes: CANJES_COUNT_ATTRIBUTES,
  });

  res.json({
    total: productos.length,
    productos: productos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      estado: p.estado,
      precio: p.precio,
      stock: p.stock,
      canjes_count: p.get
        ? p.get("canjes_count")
        : (p.getDataValue as (key: string) => unknown)("canjes_count"),
      creado: p.creado,
      actualizado: p.actualizado,
    })),
  });
});

// ADMIN endpoint: lists all products with canjes_count (requires auth/permission at route level)
const listarAdmin = asyncHandler(async (req: Request, res: Response) => {
  const order = parseSortOrder(req.query.sort);

  const productos = await Producto.findAll({
    order,
    attributes: CANJES_COUNT_ATTRIBUTES,
  });

  // Add discount info and last redeemer to each product
  // ADMIN: Do not filter by user - show all product promotions
  const lastRedeemers = await getLastRedeemersByProduct(
    productos.map((p) => p.id)
  );
  const productosConDescuentos = await Promise.all(
    productos.map((producto) =>
      enrichProductoWithDiscounts(
        producto,
        null,
        lastRedeemers.get(producto.id) ?? null
      )
    )
  );

  res.json(productosConDescuentos);
});

export = {
  listar,
  obtener,
  obtenerPorSlug,
  crear,
  editar,
  eliminar,
  actualizarPromociones,
  debugListar,
  listarAdmin,
};
