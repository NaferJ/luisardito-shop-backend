/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass
import {
  Promocion,
  PromocionProducto,
  UsoPromocion,
  Producto,
  sequelize,
} from "../models";
import promocionService from "../services/promocion.service";
import { Op } from "sequelize";
import logger from "../utils/logger";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/AppError";
import generarPDFPromociones from "../utils/promociones.pdf";

/**
 * List all promotions with filters
 */
const listar = asyncHandler(async (req: any, res: any) => {
  const { estado, tipo, activas_solo } = req.query;
  const where: any = {};

  if (estado) {
    where.estado = estado;
  }

  if (tipo) {
    where.tipo = tipo;
  }

  if (activas_solo === "true") {
    const ahora = new Date();
    where.estado = "activo";
    where.fecha_inicio = { [Op.lte]: ahora };
    where.fecha_fin = { [Op.gte]: ahora };
  }

  const promociones = await Promocion.findAll({
    where,
    include: [
      {
        model: Producto,
        as: "productos",
        through: { attributes: [] },
        attributes: ["id", "nombre", "precio", "imagen_url", "slug"],
      },
    ],
    order: [
      ["estado", "ASC"],
      ["prioridad", "DESC"],
      ["fecha_inicio", "DESC"],
    ],
  });

  res.json(promociones);
});

/**
 * Get a promotion by ID
 */
const obtener = asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;

  const promocion: any = await Promocion.findByPk(id, {
    include: [
      {
        model: Producto,
        as: "productos",
        through: { attributes: [] },
        attributes: ["id", "nombre", "precio", "imagen_url", "slug", "stock"],
      },
    ],
  });

  if (!promocion) {
    throw new AppError("Promotion not found", 404);
  }

  res.json(promocion);
});

/**
 * Create new promotion
 */
const crear = asyncHandler(async (req: any, res: any) => {
  const {
    codigo,
    nombre,
    titulo,
    descripcion,
    tipo,
    tipo_descuento,
    valor_descuento,
    descuento_maximo,
    fecha_inicio,
    fecha_fin,
    cantidad_usos_maximos,
    usos_por_usuario,
    minimo_puntos,
    requiere_codigo,
    prioridad,
    estado,
    aplica_acumulacion,
    metadata_visual,
    reglas_aplicacion,
    productos_ids,
  } = req.body;

  // Validaciones
  if (
    !nombre ||
    !titulo ||
    !tipo_descuento ||
    !valor_descuento ||
    !fecha_inicio ||
    !fecha_fin
  ) {
    throw new AppError(
      "Faltan campos requeridos: nombre, titulo, tipo_descuento, valor_descuento, fecha_inicio, fecha_fin",
      400
    );
  }

  // Validar fechas
  if (new Date(fecha_fin) <= new Date(fecha_inicio)) {
    throw new AppError(
      "La fecha de fin debe ser posterior a la fecha de inicio",
      400
    );
  }

  // Validar descuento
  if (tipo_descuento === "porcentaje" && valor_descuento > 100) {
    throw new AppError(
      "El descuento por porcentaje no puede ser mayor a 100%",
      400
    );
  }

  if (valor_descuento < 0) {
    throw new AppError("El valor del descuento no puede ser negativo", 400);
  }

  const promocion = await sequelize.transaction(async (transaction: any) => {
    // Validate unique code if provided
    if (codigo) {
      const existeCodigo = await Promocion.findOne({
        where: { codigo: codigo.toUpperCase() },
        transaction,
      });
      if (existeCodigo) {
        throw new AppError("Promotion code already exists", 400);
      }
    }

    // Create promotion
    const promo = await Promocion.create(
      {
        codigo: codigo ? codigo.toUpperCase() : null,
        nombre,
        titulo,
        descripcion,
        tipo: tipo || "producto",
        tipo_descuento,
        valor_descuento,
        descuento_maximo,
        fecha_inicio,
        fecha_fin,
        cantidad_usos_maximos,
        usos_por_usuario: usos_por_usuario || 1,
        minimo_puntos: minimo_puntos || 0,
        requiere_codigo: requiere_codigo || false,
        prioridad: prioridad || 0,
        estado: estado || "programado",
        aplica_acumulacion: aplica_acumulacion || false,
        metadata_visual: metadata_visual || {
          badge: { texto: "OFERTA", posicion: "top-right", animacion: "pulse" },
          gradiente: ["#FF6B6B", "#FF8E53"],
          badge_color: "#FF0000",
          mostrar_countdown: true,
          mostrar_ahorro: true,
        },
        reglas_aplicacion: reglas_aplicacion || {
          productos_ids: [],
          categorias_ids: [],
          excluir_productos_ids: [],
          minimo_cantidad: 1,
        },
        creado_por: req.user ? req.user.id : null,
      },
      { transaction }
    );

    // Associate products if provided
    if (
      productos_ids &&
      Array.isArray(productos_ids) &&
      productos_ids.length > 0
    ) {
      // Validate that products exist
      const productos = await Producto.findAll({
        where: { id: { [Op.in]: productos_ids } },
        transaction,
      });

      if (productos.length !== productos_ids.length) {
        throw new Error("Algunos productos no existen");
      }

      await promo.addProductos(productos, { transaction });
    }

    return promo;
  });

  // Reload with products
  const promocionCompleta = await Promocion.findByPk(promocion.id, {
    include: [
      {
        model: Producto,
        as: "productos",
        through: { attributes: [] },
        attributes: ["id", "nombre", "precio", "imagen_url", "slug"],
      },
    ],
  });

  res.status(201).json(promocionCompleta);
});

/**
 * Update existing promotion
 */
function buildUpdatePayload(
  promocion: any,
  campos: any,
  nuevaFechaInicio: any,
  nuevaFechaFin: any
) {
  return {
    codigo: campos.codigo ? campos.codigo.toUpperCase() : promocion.codigo,
    nombre: campos.nombre || promocion.nombre,
    titulo: campos.titulo || promocion.titulo,
    descripcion:
      campos.descripcion !== undefined
        ? campos.descripcion
        : promocion.descripcion,
    tipo: campos.tipo || promocion.tipo,
    tipo_descuento: campos.tipo_descuento || promocion.tipo_descuento,
    valor_descuento:
      campos.valor_descuento !== undefined
        ? campos.valor_descuento
        : promocion.valor_descuento,
    descuento_maximo:
      campos.descuento_maximo !== undefined
        ? campos.descuento_maximo
        : promocion.descuento_maximo,
    fecha_inicio: nuevaFechaInicio,
    fecha_fin: nuevaFechaFin,
    cantidad_usos_maximos:
      campos.cantidad_usos_maximos !== undefined
        ? campos.cantidad_usos_maximos
        : promocion.cantidad_usos_maximos,
    usos_por_usuario: campos.usos_por_usuario || promocion.usos_por_usuario,
    minimo_puntos:
      campos.minimo_puntos !== undefined
        ? campos.minimo_puntos
        : promocion.minimo_puntos,
    requiere_codigo:
      campos.requiere_codigo !== undefined
        ? campos.requiere_codigo
        : promocion.requiere_codigo,
    prioridad:
      campos.prioridad !== undefined ? campos.prioridad : promocion.prioridad,
    estado: campos.estado || promocion.estado,
    aplica_acumulacion:
      campos.aplica_acumulacion !== undefined
        ? campos.aplica_acumulacion
        : promocion.aplica_acumulacion,
    metadata_visual: campos.metadata_visual || promocion.metadata_visual,
    reglas_aplicacion: campos.reglas_aplicacion || promocion.reglas_aplicacion,
  };
}

async function updateProductAssociations(
  promocion: any,
  id: any,
  productos_ids: any,
  transaction: any
) {
  await PromocionProducto.destroy({
    where: { promocion_id: id },
    transaction,
  });

  if (productos_ids.length > 0) {
    const productos = await Producto.findAll({
      where: { id: { [Op.in]: productos_ids } },
      transaction,
    });

    if (productos.length !== productos_ids.length) {
      throw new Error("Algunos productos no existen");
    }

    await promocion.addProductos(productos, { transaction });
  }
}

const actualizar = asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const { productos_ids, ...campos } = req.body;

  await sequelize.transaction(async (transaction: any) => {
    const promocion: any = await Promocion.findByPk(id, { transaction });

    if (!promocion) {
      throw new AppError("Promotion not found", 404);
    }

    // Validate dates if provided
    const nuevaFechaInicio = campos.fecha_inicio || promocion.fecha_inicio;
    const nuevaFechaFin = campos.fecha_fin || promocion.fecha_fin;

    if (new Date(nuevaFechaFin) <= new Date(nuevaFechaInicio)) {
      throw new AppError(
        "La fecha de fin debe ser posterior a la fecha de inicio",
        400
      );
    }

    // Validate unique code if updating
    if (campos.codigo && campos.codigo !== promocion.codigo) {
      const existeCodigo = await Promocion.findOne({
        where: {
          codigo: campos.codigo.toUpperCase(),
          id: { [Op.ne]: id },
        },
        transaction,
      });
      if (existeCodigo) {
        throw new AppError("Promotion code already exists", 400);
      }
    }

    await promocion.update(
      buildUpdatePayload(promocion, campos, nuevaFechaInicio, nuevaFechaFin),
      { transaction }
    );

    // Update associated products if provided
    if (productos_ids !== undefined && Array.isArray(productos_ids)) {
      await updateProductAssociations(
        promocion,
        id,
        productos_ids,
        transaction
      );
    }
  });

  // Reload with products
  const promocionActualizada = await Promocion.findByPk(id, {
    include: [
      {
        model: Producto,
        as: "productos",
        through: { attributes: [] },
        attributes: ["id", "nombre", "precio", "imagen_url", "slug"],
      },
    ],
  });

  res.json(promocionActualizada);
});

/**
 * Delete promotion
 */
const eliminar = asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;

  const promocion: any = await Promocion.findByPk(id);

  if (!promocion) {
    throw new AppError("Promotion not found", 404);
  }

  // Instead of physically deleting, mark as inactive
  await promocion.update({ estado: "inactivo" });

  res.json({ mensaje: "Promotion deleted successfully" });
});

/**
 * Permanently delete a promotion
 */
const eliminarPermanente = asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;

  const promocion: any = await Promocion.findByPk(id);

  if (!promocion) {
    throw new AppError("Promotion not found", 404);
  }

  await promocion.destroy();

  res.json({ mensaje: "Promotion permanently deleted" });
});

/**
 * Get promotion statistics
 */
const obtenerEstadisticas = asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const estadisticas = await promocionService.obtenerEstadisticasPromocion(id);
  res.json(estadisticas);
});

/**
 * Validate promotion code
 */
const validarCodigo = asyncHandler(async (req: any, res: any) => {
  const { codigo, producto_id } = req.body;
  const usuarioId = req.user ? req.user.id : null;

  if (!codigo) {
    throw new AppError("Code is required", 400);
  }

  const resultado = await promocionService.validarCodigoPromocion(
    codigo,
    producto_id,
    usuarioId
  );

  if (!resultado.valido) {
    return res.status(400).json({
      valido: false,
      mensaje: resultado.mensaje,
    });
  }

  res.json({
    valido: true,
    promocion: {
      id: resultado.promocion.id,
      titulo: resultado.promocion.titulo,
      descripcion: resultado.promocion.descripcion,
      tipo_descuento: resultado.promocion.tipo_descuento,
      valor_descuento: resultado.promocion.valor_descuento,
      metadata_visual: resultado.promocion.metadata_visual,
    },
  });
});

/**
 * Get active promotions (public)
 */
const obtenerPromocionesActivas = asyncHandler(async (req: any, res: any) => {
  const promociones = await promocionService.obtenerPromocionesActivas();

  // Filter sensitive information
  const promocionesPublicas = promociones.map((promo: any) => ({
    id: promo.id,
    titulo: promo.titulo,
    descripcion: promo.descripcion,
    tipo_descuento: promo.tipo_descuento,
    valor_descuento: promo.valor_descuento,
    fecha_fin: promo.fecha_fin,
    metadata_visual: promo.metadata_visual,
    productos: promo.productos.map((p: any) => ({
      id: p.id,
      nombre: p.nombre,
      precio: p.precio,
      imagen_url: p.imagen_url,
      slug: p.slug,
    })),
  }));

  res.json(promocionesPublicas);
});

/**
 * Update promotion states (scheduled task or manual)
 */
const actualizarEstados = asyncHandler(async (req: any, res: any) => {
  await promocionService.actualizarEstadosPromociones();
  res.json({ mensaje: "Promotion states updated successfully" });
});

/**
 * Export promotions to PDF
 */
const exportarPDF = asyncHandler(async (req: any, res: any) => {
  const { estado, activas_solo } = req.query;
  const where: any = {};

  if (estado) {
    where.estado = estado;
  }

  if (activas_solo === "true") {
    const ahora = new Date();
    where.estado = "activo";
    where.fecha_inicio = { [Op.lte]: ahora };
    where.fecha_fin = { [Op.gte]: ahora };
  }

  // Separate queries to avoid GROUP BY issues
  const promociones = await Promocion.findAll({
    where,
    include: [
      {
        model: Producto,
        as: "productos",
        through: { attributes: [] },
        attributes: ["id", "nombre", "precio"],
      },
    ],
    order: [
      ["estado", "ASC"],
      ["prioridad", "DESC"],
    ],
  });

  logger.info(`[PDF Export] Total promotions found: ${promociones.length}`);

  // Get usage statistics separately and prepare data
  const promocionesConEstadisticas: any = [];

  for (const promocion of promociones) {
    const estadisticas: any = await UsoPromocion.findOne({
      where: { promocion_id: promocion.id },
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "total_usos"],
        [
          sequelize.fn("SUM", sequelize.col("descuento_aplicado")),
          "puntos_descontados",
        ],
      ],
      raw: true,
    });

    // Convert to plain object for easier PDF access
    const promocionData = {
      ...promocion.toJSON(),
      total_usos: Number.parseInt(estadisticas?.total_usos) || 0,
      puntos_descontados:
        Number.parseInt(estadisticas?.puntos_descontados) || 0,
    };

    promocionesConEstadisticas.push(promocionData);
  }

  logger.debug("[PDF Export] Sample data:", promocionesConEstadisticas[0]);

  const pdfBuffer = await generarPDFPromociones(promocionesConEstadisticas);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=promociones-${Date.now()}.pdf`
  );
  res.send(pdfBuffer);
});

/**
 * Assign promotions to a product
 */
const asignarProductos = asyncHandler(async (req: any, res: any) => {
  const { promocionId } = req.params;
  const { producto_ids } = req.body; // Array of product IDs

  if (!Array.isArray(producto_ids)) {
    throw new AppError("producto_ids must be an array", 400);
  }

  const promocion: any = await Promocion.findByPk(promocionId);
  if (!promocion) {
    throw new AppError("Promotion not found", 404);
  }

  // Remove previous assignments
  await PromocionProducto.destroy({
    where: { promocion_id: promocionId },
  });

  // Create new assignments
  if (producto_ids.length > 0) {
    const asignaciones = producto_ids.map((producto_id: any) => ({
      promocion_id: promocionId,
      producto_id,
    }));

    await PromocionProducto.bulkCreate(asignaciones, {
      ignoreDuplicates: true,
    });
  }

  res.json({
    message: "Products assigned successfully",
    promocion_id: promocionId,
    productos_asignados: producto_ids.length,
  });
});

/**
 * Unassign a product from a promotion
 */
const desasignarProducto = asyncHandler(async (req: any, res: any) => {
  const { promocionId, productoId } = req.params;

  const deleted = await PromocionProducto.destroy({
    where: {
      promocion_id: promocionId,
      producto_id: productoId,
    },
  });

  if (deleted === 0) {
    throw new AppError("Relation not found", 404);
  }

  res.json({
    message: "Product unassigned successfully",
    promocion_id: promocionId,
    producto_id: productoId,
  });
});

/**
 * Get promotions for a specific product
 */
const obtenerPromocionesProducto = asyncHandler(async (req: any, res: any) => {
  const { productoId } = req.params;

  const producto: any = await Producto.findByPk(productoId);
  if (!producto) {
    throw new AppError("Product not found", 404);
  }

  const promociones = await Promocion.findAll({
    include: [
      {
        model: Producto,
        as: "productos",
        where: { id: productoId },
        through: { attributes: [] },
        required: true,
      },
    ],
    order: [
      ["prioridad", "DESC"],
      ["fecha_inicio", "DESC"],
    ],
  });

  res.json(promociones);
});

export = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  eliminarPermanente,
  obtenerEstadisticas,
  validarCodigo,
  obtenerPromocionesActivas,
  actualizarEstados,
  exportarPDF,
  asignarProductos,
  desasignarProducto,
  obtenerPromocionesProducto,
};
