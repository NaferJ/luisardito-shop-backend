import { Notificacion } from "../models";
import logger from "../utils/logger";
import type { Transaction, WhereOptions } from "sequelize";

type NotificacionTipo =
  | "sub_regalada"
  | "puntos_ganados"
  | "canje_creado"
  | "canje_entregado"
  | "canje_cancelado"
  | "canje_devuelto"
  | "historial_evento"
  | "sistema";

interface ListarResult {
  total: number;
  page: number;
  limit: number;
  pages: number;
  notificaciones: Notificacion[];
}

interface GiftData {
  regalador_username?: string;
  monto_subscription?: string | number;
  [key: string]: unknown;
}

interface PointsData {
  cantidad?: number;
  concepto?: string;
  [key: string]: unknown;
}

interface CanjeData {
  nombre_producto?: string;
  precio?: number;
  canje_id?: number;
  motivo?: string;
  puntos_devueltos?: number;
  [key: string]: unknown;
}

class NotificacionService {
  /**
   * Create a new notification
   * @param usuarioId - Recipient user ID
   * @param titulo - Notification title
   * @param descripcion - Detailed description
   * @param tipo - Notification type (enum)
   * @param datosRelacionados - Contextual data in JSON
   * @param enlaceDetalle - Relative detail route
   * @param transaction - Sequelize transaction (optional)
   */
  static async crear(
    usuarioId: number,
    titulo: string,
    descripcion: string,
    tipo: NotificacionTipo = "sistema",
    datosRelacionados: Record<string, unknown> | null = null,
    enlaceDetalle: string | null = null,
    transaction: Transaction | null = null
  ): Promise<Notificacion> {
    try {
      const notificacion = await Notificacion.create(
        {
          usuario_id: usuarioId,
          titulo,
          descripcion,
          tipo,
          estado: "no_leida",
          datos_relacionados: datosRelacionados,
          enlace_detalle: enlaceDetalle,
        },
        { transaction }
      );

      logger.info(
        `[Notification] New notification for user ${usuarioId}: ${tipo} - ${titulo}`
      );

      return notificacion;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        `[Notification] Error creating notification for user ${usuarioId}: ${msg}`
      );
      throw error;
    }
  }

  /**
   * Get a user's notifications (paginated)
   * @param usuarioId - User ID
   * @param page - Page (default 1)
   * @param limit - Limit per page (default 20, max 100)
   * @param tipo - Filter by type (optional)
   * @param estado - Filter by status: 'leida', 'no_leida' (optional)
   */
  static async listar(
    usuarioId: number,
    page: number = 1,
    limit: number = 20,
    tipo: string | null = null,
    estado: string | null = null
  ): Promise<ListarResult> {
    try {
      // Validate max limit
      const actualLimit = Math.min(Math.max(1, limit), 100);
      const offset = (Math.max(1, page) - 1) * actualLimit;

      const where: WhereOptions = {
        usuario_id: usuarioId,
        deleted_at: null,
      };

      // Add type filter if provided
      if (
        tipo &&
        [
          "sub_regalada",
          "puntos_ganados",
          "canje_creado",
          "canje_entregado",
          "canje_cancelado",
          "canje_devuelto",
          "historial_evento",
          "sistema",
        ].includes(tipo)
      ) {
        where.tipo = tipo;
      }

      // Add status filter if provided
      if (estado && ["leida", "no_leida"].includes(estado)) {
        where.estado = estado;
      }

      const { count, rows } = await Notificacion.findAndCountAll({
        where,
        order: [["fecha_creacion", "DESC"]],
        limit: actualLimit,
        offset,
      });

      return {
        total: count,
        page: Math.max(1, page),
        limit: actualLimit,
        pages: Math.ceil(count / actualLimit),
        notificaciones: rows,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[Notification] Error listing notifications: ${msg}`);
      throw error;
    }
  }

  /**
   * Get notification by ID
   * @param notificacionId - Notification ID
   * @param usuarioId - User ID (to validate ownership)
   */
  static async obtenerDetalle(
    notificacionId: string | number,
    usuarioId: number
  ): Promise<Notificacion> {
    try {
      const notificacion = await Notificacion.findOne({
        where: {
          id: notificacionId,
          usuario_id: usuarioId,
          deleted_at: null,
        },
      });

      if (!notificacion) {
        throw new Error("Notification not found");
      }

      return notificacion;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[Notification] Error getting detail: ${msg}`);
      throw error;
    }
  }

  /**
   * Mark a notification as read
   * @param notificacionId - Notification ID
   * @param usuarioId - User ID (to validate ownership)
   */
  static async marcarComoLeida(
    notificacionId: string | number,
    usuarioId: number
  ): Promise<Notificacion> {
    try {
      const notificacion = await Notificacion.findOne({
        where: {
          id: notificacionId,
          usuario_id: usuarioId,
          deleted_at: null,
        },
      });

      if (!notificacion) {
        throw new Error("Notification not found");
      }

      // If already read, do nothing
      if (notificacion.estado === "leida") {
        return notificacion;
      }

      await notificacion.update({
        estado: "leida",
        fecha_lectura: new Date(),
      });

      logger.info(
        `[Notification] Notification #${notificacionId} marked as read`
      );
      return notificacion;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[Notification] Error marking as read: ${msg}`);
      throw error;
    }
  }

  /**
   * Mark all notifications for a user as read
   * @param usuarioId - User ID
   */
  static async marcarTodasComoLeidas(
    usuarioId: number
  ): Promise<{ cantidad_actualizadas: number }> {
    try {
      const agora = new Date();
      const [count] = await Notificacion.update(
        {
          estado: "leida",
          fecha_lectura: agora,
        },
        {
          where: {
            usuario_id: usuarioId,
            estado: "no_leida",
            deleted_at: null,
          },
        }
      );

      logger.info(
        `[Notification] ${count} notifications marked as read for user ${usuarioId}`
      );
      return { cantidad_actualizadas: count };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[Notification] Error marking all as read: ${msg}`);
      throw error;
    }
  }

  /**
   * Delete a notification (soft delete)
   * @param notificacionId - Notification ID
   * @param usuarioId - User ID (to validate ownership)
   */
  static async eliminar(
    notificacionId: string | number,
    usuarioId: number
  ): Promise<{ id: number; mensaje: string }> {
    try {
      const notificacion = await Notificacion.findOne({
        where: {
          id: notificacionId,
          usuario_id: usuarioId,
          deleted_at: null,
        },
      });

      if (!notificacion) {
        throw new Error("Notification not found");
      }

      await notificacion.update({ deleted_at: new Date() });

      logger.info(`[Notification] Notification #${notificacionId} deleted`);
      return { id: notificacionId as number, mensaje: "Notification deleted" };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[Notification] Error deleting notification: ${msg}`);
      throw error;
    }
  }

  /**
   * Count unread notifications for a user
   * @param usuarioId - User ID
   */
  static async contarNoLeidas(
    usuarioId: number
  ): Promise<{ cantidad: number }> {
    try {
      const cantidad = await Notificacion.count({
        where: {
          usuario_id: usuarioId,
          estado: "no_leida",
          deleted_at: null,
        },
      });

      return { cantidad };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[Notification] Error counting unread: ${msg}`);
      throw error;
    }
  }

  /**
   * Create gifted sub notification
   * @param usuarioId - ID of the user receiving the gift
   * @param datosRegalo - Gift data (amount, gifter, tier, etc.)
   * @param transaction - Sequelize transaction (optional)
   */
  static async crearNotificacionSubRegalada(
    usuarioId: number,
    datosRegalo: GiftData = {},
    transaction: Transaction | null = null
  ): Promise<Notificacion> {
    const regalador = datosRegalo.regalador_username || "A user";
    const monto = datosRegalo.monto_subscription || "One";
    const titulo = `You received a gifted subscription!`;
    const descripcion = `${regalador} gifted you ${monto} subscription(s)`;

    return this.crear(
      usuarioId,
      titulo,
      descripcion,
      "sub_regalada",
      datosRegalo,
      "/suscripciones",
      transaction
    );
  }

  /**
   * Create points earned notification
   * @param usuarioId - User ID
   * @param datosPuntos - Points data (amount, concept, event, etc.)
   * @param transaction - Sequelize transaction (optional)
   */
  static async crearNotificacionPuntosGanados(
    usuarioId: number,
    datosPuntos: PointsData = {},
    transaction: Transaction | null = null
  ): Promise<Notificacion> {
    const cantidad = datosPuntos.cantidad || 0;
    const concepto = datosPuntos.concepto || "Event";
    const titulo = `You earned ${cantidad} points!`;
    const descripcion = `You earned ${cantidad} points for: ${concepto}`;

    return this.crear(
      usuarioId,
      titulo,
      descripcion,
      "puntos_ganados",
      datosPuntos,
      "/historial",
      transaction
    );
  }

  /**
   * Create redemption created notification
   * @param usuarioId - User ID
   * @param datosCanjeCreado - Redemption data (product, price, etc.)
   * @param transaction - Sequelize transaction (optional)
   */
  static async crearNotificacionCanjeCreado(
    usuarioId: number,
    datosCanjeCreado: CanjeData = {},
    transaction: Transaction | null = null
  ): Promise<Notificacion> {
    const producto = datosCanjeCreado.nombre_producto || "Product";
    const precio = datosCanjeCreado.precio || 0;
    const titulo = `Redemption created!`;
    const descripcion = `Your redemption of "${producto}" for ${precio} points has been created successfully`;

    return this.crear(
      usuarioId,
      titulo,
      descripcion,
      "canje_creado",
      datosCanjeCreado,
      `/canjes/${datosCanjeCreado.canje_id || ""}`,
      transaction
    );
  }

  /**
   * Create redemption delivered notification
   * @param usuarioId - User ID
   * @param datosCanjeEntregado - Redemption data (product, etc.)
   * @param transaction - Sequelize transaction (optional)
   */
  static async crearNotificacionCanjeEntregado(
    usuarioId: number,
    datosCanjeEntregado: CanjeData = {},
    transaction: Transaction | null = null
  ): Promise<Notificacion> {
    const producto = datosCanjeEntregado.nombre_producto || "Product";
    const titulo = `Your redemption was delivered!`;
    const descripcion = `Your redemption of "${producto}" has been marked as delivered`;

    return this.crear(
      usuarioId,
      titulo,
      descripcion,
      "canje_entregado",
      datosCanjeEntregado,
      `/canjes/${datosCanjeEntregado.canje_id || ""}`,
      transaction
    );
  }

  /**
   * Create redemption cancelled notification
   * @param usuarioId - User ID
   * @param datosCanjesCancelado - Redemption data (product, reason, etc.)
   * @param transaction - Sequelize transaction (optional)
   */
  static async crearNotificacionCanjeCancelado(
    usuarioId: number,
    datosCanjesCancelado: CanjeData = {},
    transaction: Transaction | null = null
  ): Promise<Notificacion> {
    const producto = datosCanjesCancelado.nombre_producto || "Product";
    const motivo = datosCanjesCancelado.motivo || "Unspecified";
    const titulo = `Your redemption was cancelled`;
    const descripcion = `Your redemption of "${producto}" has been cancelled. Reason: ${motivo}`;

    return this.crear(
      usuarioId,
      titulo,
      descripcion,
      "canje_cancelado",
      datosCanjesCancelado,
      `/canjes/${datosCanjesCancelado.canje_id || ""}`,
      transaction
    );
  }

  /**
   * Create redemption returned notification
   * @param usuarioId - User ID
   * @param datosCanjeDevuelto - Redemption data (product, points returned, etc.)
   * @param transaction - Sequelize transaction (optional)
   */
  static async crearNotificacionCanjeDevuelto(
    usuarioId: number,
    datosCanjeDevuelto: CanjeData = {},
    transaction: Transaction | null = null
  ): Promise<Notificacion> {
    const producto = datosCanjeDevuelto.nombre_producto || "Product";
    const puntosDevueltos = datosCanjeDevuelto.puntos_devueltos || 0;
    const titulo = `Your redemption was returned`;
    const descripcion = `Your redemption of "${producto}" has been returned and ${puntosDevueltos} points were refunded to you`;

    return this.crear(
      usuarioId,
      titulo,
      descripcion,
      "canje_devuelto",
      datosCanjeDevuelto,
      `/canjes/${datosCanjeDevuelto.canje_id || ""}`,
      transaction
    );
  }
}

export default NotificacionService;
