import {
  Promocion,
  UsoPromocion,
  Producto,
  Usuario,
  sequelize,
} from "../models";
import { Op } from "sequelize";
import type { Transaction, Includeable, WhereOptions } from "sequelize";

interface DescuentoResult {
  tieneDescuento: boolean;
  precioOriginal: number;
  precioFinal: number;
  descuento: number;
  porcentajeDescuento?: string;
  promocion: {
    id: number;
    codigo: string | null;
    titulo: string;
    descripcion: string | null;
    tipo_descuento: string;
    valor_descuento: number;
    fecha_fin: Date;
    metadata_visual: Record<string, unknown> | null;
  } | null;
}

interface AplicarPromocionResult {
  uso: UsoPromocion;
  precioOriginal: number;
  descuento: number;
  precioFinal: number;
}

interface ValidarCodigoResult {
  valido: boolean;
  mensaje?: string;
  promocion?: Promocion;
}

interface EstadisticasPromocionResult {
  promocion: {
    id: number;
    nombre: string;
    titulo: string;
    estado: string;
    fecha_inicio: Date;
    fecha_fin: Date;
    tipo_descuento: string;
    valor_descuento: number;
  };
  estadisticas: {
    total_usos: number;
    usos_maximos: number | null;
    puntos_descontados_total: number;
    descuento_promedio: number;
    usuarios_unicos: number;
    productos_aplicables: number;
  };
  topUsuarios: UsoPromocion[];
  topProductos: UsoPromocion[];
}

class PromocionService {
  /**
   * Get active promotions for a specific product
   */
  async obtenerPromocionesActivasProducto(
    productoId: number,
    usuarioId: number | null = null
  ): Promise<Promocion[]> {
    const agora = new Date();

    const promociones = await Promocion.findAll({
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
        fecha_inicio: { [Op.lte]: agora },
        fecha_fin: { [Op.gte]: agora },
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
      const promocionesValidas: Promocion[] = [];
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
  async obtenerPromocionesActivas(): Promise<Promocion[]> {
    const agora = new Date();

    return await Promocion.findAll({
      where: {
        estado: "activo",
        fecha_inicio: { [Op.lte]: agora },
        fecha_fin: { [Op.gte]: agora },
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
    productoId: number,
    precioOriginal: number,
    usuarioId: number | null = null
  ): Promise<DescuentoResult> {
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
    let mejorPromocion: Promocion | null = null;
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
    promocionId: number,
    usuarioId: number,
    productoId: number,
    canjeId: number | null = null,
    externalTransaction: Transaction | null = null
  ): Promise<AplicarPromocionResult> {
    const transaction: Transaction =
      externalTransaction || (await sequelize.transaction());
    const shouldCommit = !externalTransaction; // Only commit if we created the transaction

    try {
      const promocion = await Promocion.findByPk(promocionId, {
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

      const producto = await Producto.findByPk(productoId, {
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
    } catch (error: unknown) {
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
    codigo: string,
    productoId: number | null = null,
    usuarioId: number | null = null
  ): Promise<ValidarCodigoResult> {
    const agora = new Date();

    const where: WhereOptions = {
      codigo: codigo.toUpperCase(),
      requiere_codigo: true,
      estado: "activo",
      fecha_inicio: { [Op.lte]: agora },
      fecha_fin: { [Op.gte]: agora },
    };

    const includes: Includeable[] = productoId
      ? [
          {
            model: Producto,
            as: "productos",
            where: { id: productoId },
            required: true,
            through: { attributes: [] },
          },
        ]
      : [];

    const promocion = await Promocion.findOne({
      where,
      include: includes,
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
  async actualizarEstadosPromociones(): Promise<void> {
    const agora = new Date();

    // Activate scheduled promotions that have already started
    await Promocion.update(
      { estado: "activo" },
      {
        where: {
          estado: "programado",
          fecha_inicio: { [Op.lte]: agora },
          fecha_fin: { [Op.gte]: agora },
        },
      }
    );

    // Expire active promotions that have already ended
    await Promocion.update(
      { estado: "expirado" },
      {
        where: {
          estado: "activo",
          fecha_fin: { [Op.lt]: agora },
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
  async obtenerEstadisticasPromocion(
    promocionId: number
  ): Promise<EstadisticasPromocionResult> {
    const promocion = await Promocion.findByPk(promocionId, {
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

    const estadisticas = await UsoPromocion.findOne({
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

    const stats = estadisticas as unknown as Record<
      string,
      string | number | null
    > | null;

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
        total_usos: Number.parseInt(String(stats?.total_usos)) || 0,
        usos_maximos: promocion.cantidad_usos_maximos,
        puntos_descontados_total:
          Number.parseInt(String(stats?.puntos_descontados_total)) || 0,
        descuento_promedio:
          Number.parseFloat(String(stats?.descuento_promedio)) || 0,
        usuarios_unicos: Number.parseInt(String(stats?.usuarios_unicos)) || 0,
        productos_aplicables: (promocion as unknown as { productos: unknown[] })
          .productos.length,
      },
      topUsuarios,
      topProductos,
    };
  }
}

const promocionService = new PromocionService();
export default promocionService;
