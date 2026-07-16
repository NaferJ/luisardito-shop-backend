/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass
import {
  Promocion,
  UsoPromocion,
  Producto,
  Usuario,
  sequelize,
} from "../models";
import { Op } from "sequelize";

class PromocionService {
  /**
   * Get active promotions for a specific product
   */
  async obtenerPromocionesActivasProducto(
    productoId: any,
    usuarioId: any = null
  ) {
    const ahora = new Date();

    const promociones: any = await Promocion.findAll({
      include: [
        {
          model: Producto,
          as: "productos",
          where: { id: productoId },
          through: { attributes: [] },
        },
      ],
      where: {
        estado: "activo",
        fecha_inicio: { [Op.lte]: ahora },
        fecha_fin: { [Op.gte]: ahora },
        [Op.or]: [
          { cantidad_usos_maximos: null },
          sequelize.where(
            sequelize.col("cantidad_usos_actuales"),
            Op.lt,
            sequelize.col("cantidad_usos_maximos")
          ),
        ],
      },
      order: [
        ["prioridad", "DESC"],
        ["creado", "ASC"],
      ],
    });

    // Filter promotions by user if provided
    if (usuarioId) {
      const promocionesValidas = [];
      for (const promo of promociones) {
        const puedeUsar = await promo.puedeUsarUsuario(usuarioId);
        if (puedeUsar) {
          promocionesValidas.push(promo);
        }
      }
      return promocionesValidas;
    }

    return promociones;
  }

  /**
   * Get all active promotions
   */
  async obtenerPromocionesActivas() {
    const ahora = new Date();

    return await Promocion.findAll({
      where: {
        estado: "activo",
        fecha_inicio: { [Op.lte]: ahora },
        fecha_fin: { [Op.gte]: ahora },
      },
      include: [
        {
          model: Producto,
          as: "productos",
          through: { attributes: [] },
        },
      ],
      order: [
        ["prioridad", "DESC"],
        ["fecha_inicio", "DESC"],
      ],
    });
  }

  /**
   * Calculate the best discount for a product
   */
  async calcularMejorDescuento(
    productoId: any,
    precioOriginal: any,
    usuarioId: any = null
  ) {
    const promociones = await this.obtenerPromocionesActivasProducto(
      productoId,
      usuarioId
    );

    if (promociones.length === 0) {
      return {
        tieneDescuento: false,
        precioOriginal,
        precioFinal: precioOriginal,
        descuento: 0,
        promocion: null,
      };
    }

    // Calculate discounts for all applicable promotions
    let mejorPromocion = null;
    let mayorDescuento = 0;

    for (const promo of promociones) {
      const descuento = promo.calcularDescuento(precioOriginal);
      if (descuento > mayorDescuento) {
        mayorDescuento = descuento;
        mejorPromocion = promo;
      }
    }

    const precioFinal = Math.max(0, precioOriginal - mayorDescuento);

    return {
      tieneDescuento: mayorDescuento > 0,
      precioOriginal,
      precioFinal,
      descuento: mayorDescuento,
      porcentajeDescuento: ((mayorDescuento / precioOriginal) * 100).toFixed(0),
      promocion: mejorPromocion
        ? {
            id: mejorPromocion.id,
            codigo: mejorPromocion.codigo,
            titulo: mejorPromocion.titulo,
            descripcion: mejorPromocion.descripcion,
            tipo_descuento: mejorPromocion.tipo_descuento,
            valor_descuento: mejorPromocion.valor_descuento,
            fecha_fin: mejorPromocion.fecha_fin,
            metadata_visual: mejorPromocion.metadata_visual,
          }
        : null,
    };
  }

  /**
   * Apply promotion to a product (register usage)
   */
  async aplicarPromocion(
    promocionId: any,
    usuarioId: any,
    productoId: any,
    canjeId: any = null,
    externalTransaction: any = null
  ) {
    const transaction: any =
      externalTransaction || (await sequelize.transaction());
    const shouldCommit = !externalTransaction; // Only commit if we created the transaction

    try {
      const promocion: any = await Promocion.findByPk(promocionId, {
        transaction,
      });

      if (!promocion) {
        throw new Error("Promotion not found");
      }

      if (!promocion.estaActiva()) {
        throw new Error("Promotion is not active");
      }

      const puedeUsar = await promocion.puedeUsarUsuario(usuarioId);
      if (!puedeUsar) {
        throw new Error("You have reached the usage limit for this promotion");
      }

      const producto: any = await Producto.findByPk(productoId, {
        transaction,
      });
      if (!producto) {
        throw new Error("Product not found");
      }

      const precioOriginal = producto.precio;
      const descuento = promocion.calcularDescuento(precioOriginal);
      const precioFinal = Math.max(0, precioOriginal - descuento);

      // Register the usage
      const uso = await UsoPromocion.create(
        {
          promocion_id: promocionId,
          usuario_id: usuarioId,
          canje_id: canjeId,
          producto_id: productoId,
          codigo_usado: promocion.codigo,
          precio_original: precioOriginal,
          descuento_aplicado: descuento,
          precio_final: precioFinal,
          metadata: {
            tipo_descuento: promocion.tipo_descuento,
            valor_descuento: promocion.valor_descuento,
          },
        },
        { transaction }
      );

      // Increment usage counter
      await promocion.increment("cantidad_usos_actuales", { transaction });

      if (shouldCommit) {
        await transaction.commit();
      }

      return {
        uso,
        precioOriginal,
        descuento,
        precioFinal,
      };
    } catch (error: any) {
      if (shouldCommit) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  /**
   * Validate promotion code
   */
  async validarCodigoPromocion(
    codigo: any,
    productoId: any = null,
    usuarioId: any = null
  ) {
    const ahora = new Date();

    const where = {
      codigo: codigo.toUpperCase(),
      requiere_codigo: true,
      estado: "activo",
      fecha_inicio: { [Op.lte]: ahora },
      fecha_fin: { [Op.gte]: ahora },
    };

    const promocion: any = await Promocion.findOne({
      where,
      include: productoId
        ? [
            {
              model: Producto,
              as: "productos",
              where: { id: productoId },
              required: true,
              through: { attributes: [] },
            },
          ]
        : [],
    });

    if (!promocion) {
      return {
        valido: false,
        mensaje: "Invalid or expired promotion code",
      };
    }

    if (!promocion.estaActiva()) {
      return {
        valido: false,
        mensaje: "This promotion is no longer available",
      };
    }

    if (usuarioId) {
      const puedeUsar = await promocion.puedeUsarUsuario(usuarioId);
      if (!puedeUsar) {
        return {
          valido: false,
          mensaje: "You have reached the usage limit for this code",
        };
      }
    }

    return {
      valido: true,
      promocion,
    };
  }

  /**
   * Update promotion statuses (run periodically)
   */
  async actualizarEstadosPromociones() {
    const ahora = new Date();

    // Activate scheduled promotions that have already started
    await Promocion.update(
      { estado: "activo" },
      {
        where: {
          estado: "programado",
          fecha_inicio: { [Op.lte]: ahora },
          fecha_fin: { [Op.gte]: ahora },
        },
      }
    );

    // Expire active promotions that have already ended
    await Promocion.update(
      { estado: "expirado" },
      {
        where: {
          estado: "activo",
          fecha_fin: { [Op.lt]: ahora },
        },
      }
    );

    // Expire promotions that reached the usage limit
    await Promocion.update(
      { estado: "expirado" },
      {
        where: {
          estado: "activo",
          cantidad_usos_maximos: { [Op.not]: null },
          [Op.and]: sequelize.where(
            sequelize.col("cantidad_usos_actuales"),
            Op.gte,
            sequelize.col("cantidad_usos_maximos")
          ),
        },
      }
    );
  }

  /**
   * Get promotion statistics
   */
  async obtenerEstadisticasPromocion(promocionId: any) {
    const promocion: any = await Promocion.findByPk(promocionId, {
      include: [
        {
          model: UsoPromocion,
          as: "usos",
          include: [
            { model: Usuario, attributes: ["id", "nickname"] },
            { model: Producto, attributes: ["id", "nombre", "precio"] },
          ],
        },
        {
          model: Producto,
          as: "productos",
          through: { attributes: [] },
        },
      ],
    });

    if (!promocion) {
      throw new Error("Promotion not found");
    }

    const estadisticas: any = await UsoPromocion.findOne({
      where: { promocion_id: promocionId },
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "total_usos"],
        [
          sequelize.fn("SUM", sequelize.col("descuento_aplicado")),
          "puntos_descontados_total",
        ],
        [
          sequelize.fn("AVG", sequelize.col("descuento_aplicado")),
          "descuento_promedio",
        ],
        [
          sequelize.fn(
            "COUNT",
            sequelize.fn("DISTINCT", sequelize.col("usuario_id"))
          ),
          "usuarios_unicos",
        ],
      ],
      raw: true,
    });

    // Top 5 users who have used the promotion the most
    const topUsuarios = await UsoPromocion.findAll({
      where: { promocion_id: promocionId },
      attributes: [
        "usuario_id",
        [sequelize.fn("COUNT", sequelize.col("UsoPromocion.id")), "usos"],
        [
          sequelize.fn("SUM", sequelize.col("descuento_aplicado")),
          "ahorro_total",
        ],
      ],
      include: [{ model: Usuario, attributes: ["nickname"] }],
      group: ["usuario_id", "Usuario.id"],
      order: [[sequelize.literal("usos"), "DESC"]],
      limit: 5,
    });

    // Most redeemed products with this promotion
    const topProductos = await UsoPromocion.findAll({
      where: { promocion_id: promocionId },
      attributes: [
        "producto_id",
        [sequelize.fn("COUNT", sequelize.col("UsoPromocion.id")), "canjes"],
      ],
      include: [
        { model: Producto, attributes: ["nombre", "precio", "imagen_url"] },
      ],
      group: ["producto_id", "Producto.id"],
      order: [[sequelize.literal("canjes"), "DESC"]],
      limit: 5,
    });

    return {
      promocion: {
        id: promocion.id,
        nombre: promocion.nombre,
        titulo: promocion.titulo,
        estado: promocion.estado,
        fecha_inicio: promocion.fecha_inicio,
        fecha_fin: promocion.fecha_fin,
        tipo_descuento: promocion.tipo_descuento,
        valor_descuento: promocion.valor_descuento,
      },
      estadisticas: {
        total_usos: Number.parseInt(estadisticas.total_usos) || 0,
        usos_maximos: promocion.cantidad_usos_maximos,
        puntos_descontados_total:
          Number.parseInt(estadisticas.puntos_descontados_total) || 0,
        descuento_promedio: parseFloat(estadisticas.descuento_promedio) || 0,
        usuarios_unicos: Number.parseInt(estadisticas.usuarios_unicos) || 0,
        productos_aplicables: promocion.productos.length,
      },
      topUsuarios,
      topProductos,
    };
  }
}

const promocionService = new PromocionService();
export default promocionService;
