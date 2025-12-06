const { Promocion, PromocionProducto, UsoPromocion, Producto, Usuario, sequelize } = require('../models');
const { Op } = require('sequelize');

class PromocionService {
    /**
     * Obtener promociones activas para un producto específico
     */
    async obtenerPromocionesActivasProducto(productoId, usuarioId = null) {
        const ahora = new Date();
        
        const promociones = await Promocion.findAll({
            include: [
                {
                    model: Producto,
                    as: 'productos',
                    where: { id: productoId },
                    through: { attributes: [] }
                }
            ],
            where: {
                estado: 'activo',
                fecha_inicio: { [Op.lte]: ahora },
                fecha_fin: { [Op.gte]: ahora },
                [Op.or]: [
                    { cantidad_usos_maximos: null },
                    sequelize.where(
                        sequelize.col('cantidad_usos_actuales'),
                        Op.lt,
                        sequelize.col('cantidad_usos_maximos')
                    )
                ]
            },
            order: [['prioridad', 'DESC'], ['creado', 'ASC']]
        });

        // Filtrar promociones por usuario si se proporciona
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
     * Obtener todas las promociones activas
     */
    async obtenerPromocionesActivas() {
        const ahora = new Date();
        
        return await Promocion.findAll({
            where: {
                estado: 'activo',
                fecha_inicio: { [Op.lte]: ahora },
                fecha_fin: { [Op.gte]: ahora }
            },
            include: [
                {
                    model: Producto,
                    as: 'productos',
                    through: { attributes: [] }
                }
            ],
            order: [['prioridad', 'DESC'], ['fecha_inicio', 'DESC']]
        });
    }

    /**
     * Calcular el mejor descuento para un producto
     */
    async calcularMejorDescuento(productoId, precioOriginal, usuarioId = null) {
        const promociones = await this.obtenerPromocionesActivasProducto(productoId, usuarioId);
        
        if (promociones.length === 0) {
            return {
                tieneDescuento: false,
                precioOriginal,
                precioFinal: precioOriginal,
                descuento: 0,
                promocion: null
            };
        }

        // Calcular descuentos para todas las promociones aplicables
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
            promocion: mejorPromocion ? {
                id: mejorPromocion.id,
                codigo: mejorPromocion.codigo,
                titulo: mejorPromocion.titulo,
                descripcion: mejorPromocion.descripcion,
                tipo_descuento: mejorPromocion.tipo_descuento,
                valor_descuento: mejorPromocion.valor_descuento,
                fecha_fin: mejorPromocion.fecha_fin,
                metadata_visual: mejorPromocion.metadata_visual
            } : null
        };
    }

    /**
     * Aplicar promoción a un producto (registrar uso)
     */
    async aplicarPromocion(promocionId, usuarioId, productoId, canjeId = null, externalTransaction = null) {
        const transaction = externalTransaction || await sequelize.transaction();
        const shouldCommit = !externalTransaction; // Solo hacer commit si creamos la transacción

        try {
            const promocion = await Promocion.findByPk(promocionId, { transaction });
            
            if (!promocion) {
                throw new Error('Promoción no encontrada');
            }

            if (!promocion.estaActiva()) {
                throw new Error('La promoción no está activa');
            }

            const puedeUsar = await promocion.puedeUsarUsuario(usuarioId);
            if (!puedeUsar) {
                throw new Error('Has alcanzado el límite de usos para esta promoción');
            }

            const producto = await Producto.findByPk(productoId, { transaction });
            if (!producto) {
                throw new Error('Producto no encontrado');
            }

            const precioOriginal = producto.precio;
            const descuento = promocion.calcularDescuento(precioOriginal);
            const precioFinal = Math.max(0, precioOriginal - descuento);

            // Registrar el uso
            const uso = await UsoPromocion.create({
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
                    valor_descuento: promocion.valor_descuento
                }
            }, { transaction });

            // Incrementar contador de usos
            await promocion.increment('cantidad_usos_actuales', { transaction });

            if (shouldCommit) {
                await transaction.commit();
            }

            return {
                uso,
                precioOriginal,
                descuento,
                precioFinal
            };

        } catch (error) {
            if (shouldCommit) {
                await transaction.rollback();
            }
            throw error;
        }
    }

    /**
     * Validar código de promoción
     */
    async validarCodigoPromocion(codigo, productoId = null, usuarioId = null) {
        const ahora = new Date();
        
        const where = {
            codigo: codigo.toUpperCase(),
            requiere_codigo: true,
            estado: 'activo',
            fecha_inicio: { [Op.lte]: ahora },
            fecha_fin: { [Op.gte]: ahora }
        };

        const promocion = await Promocion.findOne({
            where,
            include: productoId ? [
                {
                    model: Producto,
                    as: 'productos',
                    where: { id: productoId },
                    required: true,
                    through: { attributes: [] }
                }
            ] : []
        });

        if (!promocion) {
            return {
                valido: false,
                mensaje: 'Código de promoción inválido o expirado'
            };
        }

        if (!promocion.estaActiva()) {
            return {
                valido: false,
                mensaje: 'Esta promoción ya no está disponible'
            };
        }

        if (usuarioId) {
            const puedeUsar = await promocion.puedeUsarUsuario(usuarioId);
            if (!puedeUsar) {
                return {
                    valido: false,
                    mensaje: 'Has alcanzado el límite de usos para este código'
                };
            }
        }

        return {
            valido: true,
            promocion
        };
    }

    /**
     * Actualizar estados de promociones (ejecutar periódicamente)
     */
    async actualizarEstadosPromociones() {
        const ahora = new Date();
        
        // Activar promociones programadas que ya iniciaron
        await Promocion.update(
            { estado: 'activo' },
            {
                where: {
                    estado: 'programado',
                    fecha_inicio: { [Op.lte]: ahora },
                    fecha_fin: { [Op.gte]: ahora }
                }
            }
        );

        // Expirar promociones activas que ya terminaron
        await Promocion.update(
            { estado: 'expirado' },
            {
                where: {
                    estado: 'activo',
                    fecha_fin: { [Op.lt]: ahora }
                }
            }
        );

        // Expirar promociones que alcanzaron el límite de usos
        await Promocion.update(
            { estado: 'expirado' },
            {
                where: {
                    estado: 'activo',
                    cantidad_usos_maximos: { [Op.not]: null },
                    [Op.and]: sequelize.where(
                        sequelize.col('cantidad_usos_actuales'),
                        Op.gte,
                        sequelize.col('cantidad_usos_maximos')
                    )
                }
            }
        );
    }

    /**
     * Obtener estadísticas de una promoción
     */
    async obtenerEstadisticasPromocion(promocionId) {
        const promocion = await Promocion.findByPk(promocionId, {
            include: [
                {
                    model: UsoPromocion,
                    as: 'usos',
                    include: [
                        { model: Usuario, attributes: ['id', 'nickname', 'email'] },
                        { model: Producto, attributes: ['id', 'nombre', 'precio'] }
                    ]
                },
                {
                    model: Producto,
                    as: 'productos',
                    through: { attributes: [] }
                }
            ]
        });

        if (!promocion) {
            throw new Error('Promoción no encontrada');
        }

        const estadisticas = await UsoPromocion.findOne({
            where: { promocion_id: promocionId },
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('id')), 'total_usos'],
                [sequelize.fn('SUM', sequelize.col('descuento_aplicado')), 'puntos_descontados_total'],
                [sequelize.fn('AVG', sequelize.col('descuento_aplicado')), 'descuento_promedio'],
                [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('usuario_id'))), 'usuarios_unicos']
            ],
            raw: true
        });

        // Top 5 usuarios que más han usado la promoción
        const topUsuarios = await UsoPromocion.findAll({
            where: { promocion_id: promocionId },
            attributes: [
                'usuario_id',
                [sequelize.fn('COUNT', sequelize.col('UsoPromocion.id')), 'usos'],
                [sequelize.fn('SUM', sequelize.col('descuento_aplicado')), 'ahorro_total']
            ],
            include: [
                { model: Usuario, attributes: ['nickname', 'email'] }
            ],
            group: ['usuario_id', 'Usuario.id'],
            order: [[sequelize.literal('usos'), 'DESC']],
            limit: 5
        });

        // Productos más canjeados con esta promoción
        const topProductos = await UsoPromocion.findAll({
            where: { promocion_id: promocionId },
            attributes: [
                'producto_id',
                [sequelize.fn('COUNT', sequelize.col('UsoPromocion.id')), 'canjes']
            ],
            include: [
                { model: Producto, attributes: ['nombre', 'precio', 'imagen_url'] }
            ],
            group: ['producto_id', 'Producto.id'],
            order: [[sequelize.literal('canjes'), 'DESC']],
            limit: 5
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
                valor_descuento: promocion.valor_descuento
            },
            estadisticas: {
                total_usos: parseInt(estadisticas.total_usos) || 0,
                usos_maximos: promocion.cantidad_usos_maximos,
                puntos_descontados_total: parseInt(estadisticas.puntos_descontados_total) || 0,
                descuento_promedio: parseFloat(estadisticas.descuento_promedio) || 0,
                usuarios_unicos: parseInt(estadisticas.usuarios_unicos) || 0,
                productos_aplicables: promocion.productos.length
            },
            topUsuarios,
            topProductos
        };
    }
}

module.exports = new PromocionService();
