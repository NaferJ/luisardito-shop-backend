const { Notificacion, Usuario } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class NotificacionService {
    /**
     * Crear una nueva notificación
     * @param {number} usuarioId - ID del usuario destinatario
     * @param {string} titulo - Título de la notificación
     * @param {string} descripcion - Descripción detallada
     * @param {string} tipo - Tipo de notificación (enum)
     * @param {Object} datosRelacionados - Datos contextuales en JSON
     * @param {string} enlaceDetalle - Ruta relativa de detalle
     * @param {Object} transaction - Transacción de Sequelize (opcional)
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
                `📬 [Notificación] Nueva notificación para usuario ${usuarioId}: ${tipo} - ${titulo}`
            );

            return notificacion;
        } catch (error) {
            logger.error(
                `❌ [Notificación] Error creando notificación para usuario ${usuarioId}: ${error.message}`
            );
            throw error;
        }
    }

    /**
     * Obtener notificaciones de un usuario (paginadas)
     * @param {number} usuarioId - ID del usuario
     * @param {number} page - Página (por defecto 1)
     * @param {number} limit - Límite por página (por defecto 20, máximo 100)
     * @param {string} tipo - Filtro por tipo (opcional)
     * @param {string} estado - Filtro por estado: 'leida', 'no_leida' (opcional)
     */
    static async listar(usuarioId, page = 1, limit = 20, tipo = null, estado = null) {
        try {
            // Validar límite máximo
            const actualLimit = Math.min(Math.max(1, limit), 100);
            const offset = (Math.max(1, page) - 1) * actualLimit;

            let where = {
                usuario_id: usuarioId,
                deleted_at: null
            };

            // Agregar filtro de tipo si se proporciona
            if (tipo && ['sub_regalada', 'puntos_ganados', 'canje_creado', 'canje_entregado', 'canje_cancelado', 'canje_devuelto', 'historial_evento', 'sistema'].includes(tipo)) {
                where.tipo = tipo;
            }

            // Agregar filtro de estado si se proporciona
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
            logger.error(`❌ [Notificación] Error listando notificaciones: ${error.message}`);
            throw error;
        }
    }

    /**
     * Obtener notificación por ID
     * @param {number} notificacionId - ID de la notificación
     * @param {number} usuarioId - ID del usuario (para validar propiedad)
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
                throw new Error('Notificación no encontrada');
            }

            return notificacion;
        } catch (error) {
            logger.error(`❌ [Notificación] Error obteniendo detalle: ${error.message}`);
            throw error;
        }
    }

    /**
     * Marcar una notificación como leída
     * @param {number} notificacionId - ID de la notificación
     * @param {number} usuarioId - ID del usuario (para validar propiedad)
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
                throw new Error('Notificación no encontrada');
            }

            // Si ya está leída, no hacer nada
            if (notificacion.estado === 'leida') {
                return notificacion;
            }

            await notificacion.update({
                estado: 'leida',
                fecha_lectura: new Date()
            });

            logger.info(`✅ [Notificación] Notificación #${notificacionId} marcada como leída`);
            return notificacion;
        } catch (error) {
            logger.error(`❌ [Notificación] Error marcando como leída: ${error.message}`);
            throw error;
        }
    }

    /**
     * Marcar todas las notificaciones de un usuario como leídas
     * @param {number} usuarioId - ID del usuario
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

            logger.info(`✅ [Notificación] ${count} notificaciones marcadas como leídas para usuario ${usuarioId}`);
            return { cantidad_actualizadas: count };
        } catch (error) {
            logger.error(`❌ [Notificación] Error marcando todas como leídas: ${error.message}`);
            throw error;
        }
    }

    /**
     * Eliminar una notificación (soft delete)
     * @param {number} notificacionId - ID de la notificación
     * @param {number} usuarioId - ID del usuario (para validar propiedad)
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
                throw new Error('Notificación no encontrada');
            }

            await notificacion.update({ deleted_at: new Date() });

            logger.info(`✅ [Notificación] Notificación #${notificacionId} eliminada`);
            return { id: notificacionId, mensaje: 'Notificación eliminada' };
        } catch (error) {
            logger.error(`❌ [Notificación] Error eliminando notificación: ${error.message}`);
            throw error;
        }
    }

    /**
     * Contar notificaciones no leídas de un usuario
     * @param {number} usuarioId - ID del usuario
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
            logger.error(`❌ [Notificación] Error contando no leídas: ${error.message}`);
            throw error;
        }
    }

    /**
     * Crear notificación de sub regalada
     * @param {number} usuarioId - ID del usuario que recibe el regalo
     * @param {Object} datosRegalo - Datos del regalo (monto, regalador, nivel, etc.)
     * @param {Object} transaction - Transacción de Sequelize (opcional)
     */
    static async crearNotificacionSubRegalada(usuarioId, datosRegalo = {}, transaction = null) {
        const regalador = datosRegalo.regalador_username || 'Un usuario';
        const monto = datosRegalo.monto_subscription || 'Una';
        const titulo = `¡Recibiste un regalo de suscripción!`;
        const descripcion = `${regalador} te regaló ${monto} suscripción(es)`;

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
     * Crear notificación de puntos ganados
     * @param {number} usuarioId - ID del usuario
     * @param {Object} datosPuntos - Datos de los puntos (cantidad, concepto, evento, etc.)
     * @param {Object} transaction - Transacción de Sequelize (opcional)
     */
    static async crearNotificacionPuntosGanados(usuarioId, datosPuntos = {}, transaction = null) {
        const cantidad = datosPuntos.cantidad || 0;
        const concepto = datosPuntos.concepto || 'Evento';
        const titulo = `¡Ganaste ${cantidad} puntos!`;
        const descripcion = `Has ganado ${cantidad} puntos por: ${concepto}`;

        return this.crear(
            usuarioId,
            titulo,
            descripcion,
            'puntos_ganados',
            datosPuntos,
            '/historial-puntos',
            transaction
        );
    }

    /**
     * Crear notificación de canje creado
     * @param {number} usuarioId - ID del usuario
     * @param {Object} datosCanjeCreado - Datos del canje (producto, precio, etc.)
     * @param {Object} transaction - Transacción de Sequelize (opcional)
     */
    static async crearNotificacionCanjeCreado(usuarioId, datosCanjeCreado = {}, transaction = null) {
        const producto = datosCanjeCreado.nombre_producto || 'Producto';
        const precio = datosCanjeCreado.precio || 0;
        const titulo = `¡Canje creado!`;
        const descripcion = `Tu canje de "${producto}" por ${precio} puntos ha sido creado exitosamente`;

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
     * Crear notificación de canje entregado
     * @param {number} usuarioId - ID del usuario
     * @param {Object} datosCanjeEntregado - Datos del canje (producto, etc.)
     * @param {Object} transaction - Transacción de Sequelize (opcional)
     */
    static async crearNotificacionCanjeEntregado(usuarioId, datosCanjeEntregado = {}, transaction = null) {
        const producto = datosCanjeEntregado.nombre_producto || 'Producto';
        const titulo = `¡Tu canje fue entregado!`;
        const descripcion = `Tu canje de "${producto}" ha sido marcado como entregado`;

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
     * Crear notificación de canje cancelado
     * @param {number} usuarioId - ID del usuario
     * @param {Object} datosCanjesCancelado - Datos del canje (producto, motivo, etc.)
     * @param {Object} transaction - Transacción de Sequelize (opcional)
     */
    static async crearNotificacionCanjeCancelado(usuarioId, datosCanjesCancelado = {}, transaction = null) {
        const producto = datosCanjesCancelado.nombre_producto || 'Producto';
        const motivo = datosCanjesCancelado.motivo || 'Sin especificar';
        const titulo = `Tu canje fue cancelado`;
        const descripcion = `Tu canje de "${producto}" ha sido cancelado. Motivo: ${motivo}`;

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
     * Crear notificación de canje devuelto
     * @param {number} usuarioId - ID del usuario
     * @param {Object} datosCanjeDevuelto - Datos del canje (producto, puntos devueltos, etc.)
     * @param {Object} transaction - Transacción de Sequelize (opcional)
     */
    static async crearNotificacionCanjeDevuelto(usuarioId, datosCanjeDevuelto = {}, transaction = null) {
        const producto = datosCanjeDevuelto.nombre_producto || 'Producto';
        const puntosDevueltos = datosCanjeDevuelto.puntos_devueltos || 0;
        const titulo = `Tu canje fue devuelto`;
        const descripcion = `Tu canje de "${producto}" ha sido devuelto y se te devolvieron ${puntosDevueltos} puntos`;

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

