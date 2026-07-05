const { Notificacion, Usuario } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class NotificacionService {
    /**
     * Create a new notification
     * @param {number} usuarioId - Recipient user ID
     * @param {string} titulo - Notification title
     * @param {string} descripcion - Detailed description
     * @param {string} tipo - Notification type (enum)
     * @param {Object} datosRelacionados - Contextual data in JSON
     * @param {string} enlaceDetalle - Relative detail route
     * @param {Object} transaction - Sequelize transaction (optional)
     */
    static async crear(
        usuarioId,
        titulo,
        descripcion,
        tipo = 'sistema',
        datosRelacionados = null,
        enlaceDetalle = null,
        transaction = null
    ) {
        try {
            const notificacion = await Notificacion.create({
                usuario_id: usuarioId,
                titulo,
                descripcion,
                tipo,
                estado: 'no_leida',
                datos_relacionados: datosRelacionados,
                enlace_detalle: enlaceDetalle
            }, { transaction });

            logger.info(
                `[Notification] New notification for user ${usuarioId}: ${tipo} - ${titulo}`
            );

            return notificacion;
        } catch (error) {
            logger.error(
                `[Notification] Error creating notification for user ${usuarioId}: ${error.message}`
            );
            throw error;
        }
    }

    /**
     * Get a user's notifications (paginated)
     * @param {number} usuarioId - User ID
     * @param {number} page - Page (default 1)
     * @param {number} limit - Limit per page (default 20, max 100)
     * @param {string} tipo - Filter by type (optional)
     * @param {string} estado - Filter by status: 'leida', 'no_leida' (optional)
     */
    static async listar(usuarioId, page = 1, limit = 20, tipo = null, estado = null) {
        try {
            // Validate max limit
            const actualLimit = Math.min(Math.max(1, limit), 100);
            const offset = (Math.max(1, page) - 1) * actualLimit;

            let where = {
                usuario_id: usuarioId,
                deleted_at: null
            };

            // Add type filter if provided
            if (tipo && ['sub_regalada', 'puntos_ganados', 'canje_creado', 'canje_entregado', 'canje_cancelado', 'canje_devuelto', 'historial_evento', 'sistema'].includes(tipo)) {
                where.tipo = tipo;
            }

            // Add status filter if provided
            if (estado && ['leida', 'no_leida'].includes(estado)) {
                where.estado = estado;
            }

            const { count, rows } = await Notificacion.findAndCountAll({
                where,
                order: [['fecha_creacion', 'DESC']],
                limit: actualLimit,
                offset
            });

            return {
                total: count,
                page: Math.max(1, page),
                limit: actualLimit,
                pages: Math.ceil(count / actualLimit),
                notificaciones: rows
            };
        } catch (error) {
            logger.error(`[Notification] Error listing notifications: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get notification by ID
     * @param {number} notificacionId - Notification ID
     * @param {number} usuarioId - User ID (to validate ownership)
     */
    static async obtenerDetalle(notificacionId, usuarioId) {
        try {
            const notificacion = await Notificacion.findOne({
                where: {
                    id: notificacionId,
                    usuario_id: usuarioId,
                    deleted_at: null
                }
            });

            if (!notificacion) {
                throw new Error('Notification not found');
            }

            return notificacion;
        } catch (error) {
            logger.error(`[Notification] Error getting detail: ${error.message}`);
            throw error;
        }
    }

    /**
     * Mark a notification as read
     * @param {number} notificacionId - Notification ID
     * @param {number} usuarioId - User ID (to validate ownership)
     */
    static async marcarComoLeida(notificacionId, usuarioId) {
        try {
            const notificacion = await Notificacion.findOne({
                where: {
                    id: notificacionId,
                    usuario_id: usuarioId,
                    deleted_at: null
                }
            });

            if (!notificacion) {
                throw new Error('Notification not found');
            }

            // If already read, do nothing
            if (notificacion.estado === 'leida') {
                return notificacion;
            }

            await notificacion.update({
                estado: 'leida',
                fecha_lectura: new Date()
            });

            logger.info(`[Notification] Notification #${notificacionId} marked as read`);
            return notificacion;
        } catch (error) {
            logger.error(`[Notification] Error marking as read: ${error.message}`);
            throw error;
        }
    }

    /**
     * Mark all notifications for a user as read
     * @param {number} usuarioId - User ID
     */
    static async marcarTodasComoLeidas(usuarioId) {
        try {
            const ahora = new Date();
            const [, count] = await Notificacion.update(
                {
                    estado: 'leida',
                    fecha_lectura: ahora
                },
                {
                    where: {
                        usuario_id: usuarioId,
                        estado: 'no_leida',
                        deleted_at: null
                    }
                }
            );

            logger.info(`[Notification] ${count} notifications marked as read for user ${usuarioId}`);
            return { cantidad_actualizadas: count };
        } catch (error) {
            logger.error(`[Notification] Error marking all as read: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete a notification (soft delete)
     * @param {number} notificacionId - Notification ID
     * @param {number} usuarioId - User ID (to validate ownership)
     */
    static async eliminar(notificacionId, usuarioId) {
        try {
            const notificacion = await Notificacion.findOne({
                where: {
                    id: notificacionId,
                    usuario_id: usuarioId,
                    deleted_at: null
                }
            });

            if (!notificacion) {
                throw new Error('Notification not found');
            }

            await notificacion.update({ deleted_at: new Date() });

            logger.info(`[Notification] Notification #${notificacionId} deleted`);
            return { id: notificacionId, mensaje: 'Notification deleted' };
        } catch (error) {
            logger.error(`[Notification] Error deleting notification: ${error.message}`);
            throw error;
        }
    }

    /**
     * Count unread notifications for a user
     * @param {number} usuarioId - User ID
     */
    static async contarNoLeidas(usuarioId) {
        try {
            const cantidad = await Notificacion.count({
                where: {
                    usuario_id: usuarioId,
                    estado: 'no_leida',
                    deleted_at: null
                }
            });

            return { cantidad };
        } catch (error) {
            logger.error(`[Notification] Error counting unread: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create gifted sub notification
     * @param {number} usuarioId - ID of the user receiving the gift
     * @param {Object} datosRegalo - Gift data (amount, gifter, tier, etc.)
     * @param {Object} transaction - Sequelize transaction (optional)
     */
    static async crearNotificacionSubRegalada(usuarioId, datosRegalo = {}, transaction = null) {
        const regalador = datosRegalo.regalador_username || 'A user';
        const monto = datosRegalo.monto_subscription || 'One';
        const titulo = `You received a gifted subscription!`;
        const descripcion = `${regalador} gifted you ${monto} subscription(s)`;

        return this.crear(
            usuarioId,
            titulo,
            descripcion,
            'sub_regalada',
            datosRegalo,
            '/suscripciones',
            transaction
        );
    }

    /**
     * Create points earned notification
     * @param {number} usuarioId - User ID
     * @param {Object} datosPuntos - Points data (amount, concept, event, etc.)
     * @param {Object} transaction - Sequelize transaction (optional)
     */
    static async crearNotificacionPuntosGanados(usuarioId, datosPuntos = {}, transaction = null) {
        const cantidad = datosPuntos.cantidad || 0;
        const concepto = datosPuntos.concepto || 'Event';
        const titulo = `You earned ${cantidad} points!`;
        const descripcion = `You earned ${cantidad} points for: ${concepto}`;

        return this.crear(
            usuarioId,
            titulo,
            descripcion,
            'puntos_ganados',
            datosPuntos,
            '/historial',
            transaction
        );
    }

    /**
     * Create redemption created notification
     * @param {number} usuarioId - User ID
     * @param {Object} datosCanjeCreado - Redemption data (product, price, etc.)
     * @param {Object} transaction - Sequelize transaction (optional)
     */
    static async crearNotificacionCanjeCreado(usuarioId, datosCanjeCreado = {}, transaction = null) {
        const producto = datosCanjeCreado.nombre_producto || 'Product';
        const precio = datosCanjeCreado.precio || 0;
        const titulo = `Redemption created!`;
        const descripcion = `Your redemption of "${producto}" for ${precio} points has been created successfully`;

        return this.crear(
            usuarioId,
            titulo,
            descripcion,
            'canje_creado',
            datosCanjeCreado,
            `/canjes/${datosCanjeCreado.canje_id || ''}`,
            transaction
        );
    }

    /**
     * Create redemption delivered notification
     * @param {number} usuarioId - User ID
     * @param {Object} datosCanjeEntregado - Redemption data (product, etc.)
     * @param {Object} transaction - Sequelize transaction (optional)
     */
    static async crearNotificacionCanjeEntregado(usuarioId, datosCanjeEntregado = {}, transaction = null) {
        const producto = datosCanjeEntregado.nombre_producto || 'Product';
        const titulo = `Your redemption was delivered!`;
        const descripcion = `Your redemption of "${producto}" has been marked as delivered`;

        return this.crear(
            usuarioId,
            titulo,
            descripcion,
            'canje_entregado',
            datosCanjeEntregado,
            `/canjes/${datosCanjeEntregado.canje_id || ''}`,
            transaction
        );
    }

    /**
     * Create redemption cancelled notification
     * @param {number} usuarioId - User ID
     * @param {Object} datosCanjesCancelado - Redemption data (product, reason, etc.)
     * @param {Object} transaction - Sequelize transaction (optional)
     */
    static async crearNotificacionCanjeCancelado(usuarioId, datosCanjesCancelado = {}, transaction = null) {
        const producto = datosCanjesCancelado.nombre_producto || 'Product';
        const motivo = datosCanjesCancelado.motivo || 'Unspecified';
        const titulo = `Your redemption was cancelled`;
        const descripcion = `Your redemption of "${producto}" has been cancelled. Reason: ${motivo}`;

        return this.crear(
            usuarioId,
            titulo,
            descripcion,
            'canje_cancelado',
            datosCanjesCancelado,
            `/canjes/${datosCanjesCancelado.canje_id || ''}`,
            transaction
        );
    }

    /**
     * Create redemption returned notification
     * @param {number} usuarioId - User ID
     * @param {Object} datosCanjeDevuelto - Redemption data (product, points returned, etc.)
     * @param {Object} transaction - Sequelize transaction (optional)
     */
    static async crearNotificacionCanjeDevuelto(usuarioId, datosCanjeDevuelto = {}, transaction = null) {
        const producto = datosCanjeDevuelto.nombre_producto || 'Product';
        const puntosDevueltos = datosCanjeDevuelto.puntos_devueltos || 0;
        const titulo = `Your redemption was returned`;
        const descripcion = `Your redemption of "${producto}" has been returned and ${puntosDevueltos} points were refunded to you`;

        return this.crear(
            usuarioId,
            titulo,
            descripcion,
            'canje_devuelto',
            datosCanjeDevuelto,
            `/canjes/${datosCanjeDevuelto.canje_id || ''}`,
            transaction
        );
    }
}

module.exports = NotificacionService;

