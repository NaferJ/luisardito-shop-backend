const { Producto, Promocion, sequelize } = require("../models");
const { Op } = require("sequelize");
const promocionService = require("../services/promocion.service");
const logger = require("../utils/logger");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

// List all (with price sort; default DESC). For public, usually only published.
exports.listar = asyncHandler(async (req, res) => {
  const where = {};

  if (!req.user || req.user.rol_id <= 2) {
    // Non-logged-in or basic users (role 1-2) only see published products
    where.estado = "publicado";
  }

  // Sort support: ?sort=price_desc | price_asc | precio_desc | precio_asc
  const sortParam = (req.query.sort || "").toString().toLowerCase();
  let order;
  switch (sortParam) {
    case "price_asc":
    case "precio_asc":
      order = [["precio", "ASC"]];
      break;
    case "price_desc":
    case "precio_desc":
    default:
      order = [["precio", "DESC"]];
      break;
  }

  const productos = await Producto.findAll({
    where,
    order,
    attributes: {
      include: [
        [
          sequelize.literal(
            "(SELECT COUNT(*) FROM canjes c WHERE c.producto_id = Producto.id AND c.estado != 'devuelto')"
          ),
          "canjes_count",
        ],
      ],
    },
  });

  // Add discount info to each product
  const usuarioId = req.user ? req.user.id : null;
  const productosConDescuentos = await Promise.all(
    productos.map(async (producto) => {
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
        promocion_id: infoDescuento.promocion
          ? infoDescuento.promocion.id
          : null,
      };
    })
  );

  res.json(productosConDescuentos);
});

exports.obtener = asyncHandler(async (req, res) => {
  const producto = await Producto.findByPk(req.params.id, {
    attributes: {
      include: [
        [
          sequelize.literal(
            "(SELECT COUNT(*) FROM canjes c WHERE c.producto_id = Producto.id AND c.estado != 'devuelto')"
          ),
          "canjes_count",
        ],
      ],
    },
  });
  if (!producto) throw new AppError("Not found", 404);

  // Add discount info
  const usuarioId = req.user ? req.user.id : null;
  const infoDescuento = await promocionService.calcularMejorDescuento(
    producto.id,
    producto.precio,
    usuarioId
  );

  // Get active promotions for the product
  const promocionesActivas =
    await promocionService.obtenerPromocionesActivasProducto(
      producto.id,
      usuarioId
    );

  res.json({
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
  });
});

exports.obtenerPorSlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  let where = { slug };

  if (!req.user || req.user.rol_id <= 2) {
    where.estado = "publicado";
  } else {
    where.estado = { [Op.in]: ["publicado", "borrador"] };
  }

  const producto = await Producto.findOne({
    where,
    attributes: {
      include: [
        [
          sequelize.literal(
            "(SELECT COUNT(*) FROM canjes c WHERE c.producto_id = Producto.id AND c.estado != 'devuelto')"
          ),
          "canjes_count",
        ],
      ],
    },
  });

  if (!producto) throw new AppError("Product not found", 404);

  // Add discount info
  const usuarioId = req.user ? req.user.id : null;
  const infoDescuento = await promocionService.calcularMejorDescuento(
    producto.id,
    producto.precio,
    usuarioId
  );

  // Get active promotions for the product
  const promocionesActivas =
    await promocionService.obtenerPromocionesActivasProducto(
      producto.id,
      usuarioId
    );

  res.json({
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
  });
});

exports.crear = async (req, res) => {
  try {
    const producto = await Producto.create(req.body);
    res.status(201).json(producto);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.editar = async (req, res) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) return res.status(404).json({ error: "Not found" });
    await producto.update(req.body);
    res.json(producto);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.eliminar = async (req, res) => {
  const producto = await Producto.findByPk(req.params.id);
  if (!producto) return res.status(404).json({ error: "Not found" });
  await producto.destroy();
  res.json({ message: "Product deleted" });
};

/**
 * Update product promotions
 */
exports.actualizarPromociones = async (req, res) => {
  try {
    const { id } = req.params;
    const { promocion_ids } = req.body; // Array of promotion IDs to assign

    if (!Array.isArray(promocion_ids)) {
      return res.status(400).json({ error: "promocion_ids must be an array" });
    }

    const producto = await Producto.findByPk(id);
    if (!producto) {
      return res.status(404).json({ error: "Product not found" });
    }

    const { PromocionProducto } = require("../models");

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
  } catch (error) {
    logger.error("Error updating product promotions:", error);
    res.status(500).json({ error: "Error updating promotions" });
  }
};

// Debug endpoint to list all products without filters
exports.debugListar = async (req, res) => {
  try {
    const productos = await Producto.findAll({
      order: [["id", "ASC"]],
      attributes: {
        include: [
          [
            sequelize.literal(
              "(SELECT COUNT(*) FROM canjes c WHERE c.producto_id = Producto.id AND c.estado != 'devuelto')"
            ),
            "canjes_count",
          ],
        ],
      },
    });

    res.json({
      total: productos.length,
      productos: productos.map((p) => ({
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
  } catch (error) {
    logger.error("[DEBUG] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// ADMIN endpoint: lists all products with canjes_count (requires auth/permission at route level)
exports.listarAdmin = asyncHandler(async (req, res) => {
  // Sort support as in public
  const sortParam = (req.query.sort || "").toString().toLowerCase();
  let order;
  switch (sortParam) {
    case "price_asc":
    case "precio_asc":
      order = [["precio", "ASC"]];
      break;
    case "price_desc":
    case "precio_desc":
    default:
      order = [["precio", "DESC"]];
      break;
  }

  const productos = await Producto.findAll({
    order,
    attributes: {
      include: [
        [
          sequelize.literal(
            "(SELECT COUNT(*) FROM canjes c WHERE c.producto_id = Producto.id AND c.estado != 'devuelto')"
          ),
          "canjes_count",
        ],
      ],
    },
  });

  // Add discount info to each product
  // ADMIN: Do not filter by user - show all product promotions
  const productosConDescuentos = await Promise.all(
    productos.map(async (producto) => {
      const infoDescuento = await promocionService.calcularMejorDescuento(
        producto.id,
        producto.precio,
        null // null = no user filter
      );

      const promocionesActivas =
        await promocionService.obtenerPromocionesActivasProducto(
          producto.id,
          null
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
        promocion_id: infoDescuento.promocion
          ? infoDescuento.promocion.id
          : null,
      };
    })
  );

  res.json(productosConDescuentos);
});
