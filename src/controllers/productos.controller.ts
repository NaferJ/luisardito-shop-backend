/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass
import { Producto, Promocion, PromocionProducto, sequelize } from "../models";
import { Op } from "sequelize";
import promocionService from "../services/promocion.service";
import logger from "../utils/logger";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/AppError";

const CANJES_COUNT_ATTRIBUTES: any = {
  include: [
    [
      sequelize.literal(
        "(SELECT COUNT(*) FROM canjes c WHERE c.producto_id = Producto.id AND c.estado != 'devuelto')"
      ),
      "canjes_count",
    ],
  ],
};

function parseSortOrder(sortParam: any): any {
  switch ((sortParam || "").toString().toLowerCase()) {
    case "price_asc":
    case "precio_asc":
      return [["precio", "ASC"]];
    case "price_desc":
    case "precio_desc":
    default:
      return [["precio", "DESC"]];
  }
}

async function enrichProductoWithDiscounts(producto: any, usuarioId: any) {
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
    promociones_activas: promocionesActivas.map((p: any) => ({
      id: p.id,
      codigo: p.codigo,
      titulo: p.titulo,
      tipo_descuento: p.tipo_descuento,
      valor_descuento: p.valor_descuento,
    })),
    promocion_id: infoDescuento.promocion ? infoDescuento.promocion.id : null,
  };
}

async function buildProductoDetailResponse(producto: any, usuarioId: any) {
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
    promociones_activas: promocionesActivas.map((p: any) => ({
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
  };
}

// List all (with price sort; default DESC). For public, usually only published.
const listar = asyncHandler(async (req: any, res: any) => {
  const where: any = {};

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

  // Add discount info to each product
  const usuarioId = req.user ? req.user.id : null;
  const productosConDescuentos = await Promise.all(
    productos.map((producto: any) =>
      enrichProductoWithDiscounts(producto, usuarioId)
    )
  );

  res.json(productosConDescuentos);
});

const obtener = asyncHandler(async (req: any, res: any) => {
  const producto: any = await Producto.findByPk(req.params.id, {
    attributes: CANJES_COUNT_ATTRIBUTES,
  });
  if (!producto) throw new AppError("Not found", 404);

  const usuarioId = req.user ? req.user.id : null;
  res.json(await buildProductoDetailResponse(producto, usuarioId));
});

const obtenerPorSlug = asyncHandler(async (req: any, res: any) => {
  const { slug } = req.params;
  const where: any = { slug };

  if (!req.user || req.user.rol_id <= 2) {
    where.estado = "publicado";
  } else {
    where.estado = { [Op.in]: ["publicado", "borrador"] };
  }

  const producto: any = await Producto.findOne({
    where,
    attributes: CANJES_COUNT_ATTRIBUTES,
  });

  if (!producto) throw new AppError("Product not found", 404);

  const usuarioId = req.user ? req.user.id : null;
  res.json(await buildProductoDetailResponse(producto, usuarioId));
});

const crear = asyncHandler(async (req: any, res: any) => {
  try {
    const producto = await Producto.create(req.body);
    res.status(201).json(producto);
  } catch (err: any) {
    throw new AppError(err.message, 400);
  }
});

const editar = asyncHandler(async (req: any, res: any) => {
  const producto: any = await Producto.findByPk(req.params.id);
  if (!producto) throw new AppError("Not found", 404);
  try {
    await producto.update(req.body);
    res.json(producto);
  } catch (err: any) {
    throw new AppError(err.message, 400);
  }
});

const eliminar = asyncHandler(async (req: any, res: any) => {
  const producto: any = await Producto.findByPk(req.params.id);
  if (!producto) throw new AppError("Not found", 404);
  await producto.destroy();
  res.json({ message: "Product deleted" });
});

/**
 * Update product promotions
 */
const actualizarPromociones = asyncHandler(async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { promocion_ids } = req.body; // Array of promotion IDs to assign

    if (!Array.isArray(promocion_ids)) {
      throw new AppError("promocion_ids must be an array", 400);
    }

    const producto: any = await Producto.findByPk(id);
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
      const estaAsignado: any = await PromocionProducto.findOne({
        where: {
          promocion_id: promo.id,
          producto_id: id,
        },
      });

      if (debeEstar && !estaAsignado) {
        // Add relation
        await PromocionProducto.create({
          promocion_id: promo.id,
          producto_id: id,
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
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error("Error updating product promotions:", error);
    throw new AppError("Error updating promotions", 500);
  }
});

// Debug endpoint to list all products without filters
const debugListar = asyncHandler(async (req: any, res: any) => {
  const productos = await Producto.findAll({
    order: [["id", "ASC"]],
    attributes: CANJES_COUNT_ATTRIBUTES,
  });

  res.json({
    total: productos.length,
    productos: productos.map((p: any) => ({
      id: p.id,
      nombre: p.nombre,
      estado: p.estado,
      precio: p.precio,
      stock: p.stock,
      canjes_count: p.get ? p.get("canjes_count") : p.canjes_count,
      creado: p.creado,
      actualizado: p.actualizado,
    })),
  });
});

// ADMIN endpoint: lists all products with canjes_count (requires auth/permission at route level)
const listarAdmin = asyncHandler(async (req: any, res: any) => {
  const order = parseSortOrder(req.query.sort);

  const productos = await Producto.findAll({
    order,
    attributes: CANJES_COUNT_ATTRIBUTES,
  });

  // Add discount info to each product
  // ADMIN: Do not filter by user - show all product promotions
  const productosConDescuentos = await Promise.all(
    productos.map((producto: any) =>
      enrichProductoWithDiscounts(producto, null)
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
