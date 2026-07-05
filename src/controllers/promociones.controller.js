const { Promocion, PromocionProducto, UsoPromocion, Producto, sequelize } = require('../models');
const promocionService = require('../services/promocion.service');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * List all promotions with filters
 */
exports.listar = async (req, res) => {
    try {
        const { estado, tipo, activas_solo } = req.query;
        const where = {};

        if (estado) {
            where.estado = estado;
        }

        if (tipo) {
            where.tipo = tipo;
        }

        if (activas_solo === 'true') {
            const ahora = new Date();
            where.estado = 'activo';
            where.fecha_inicio = { [Op.lte]: ahora };
            where.fecha_fin = { [Op.gte]: ahora };
        }

        const promociones = await Promocion.findAll({
            where,
            include: [
                {
                    model: Producto,
                    as: 'productos',
                    through: { attributes: [] },
                    attributes: ['id', 'nombre', 'precio', 'imagen_url', 'slug']
                }
            ],
            order: [
                ['estado', 'ASC'],
                ['prioridad', 'DESC'],
                ['fecha_inicio', 'DESC']
            ]
        });

        res.json(promociones);
    } catch (error) {
        logger.error('Error listing promotions:', error);
        res.status(500).json({ error: 'Error fetching promotions' });
    }
};

/**
 * Get a promotion by ID
 */
exports.obtener = async (req, res) => {
    try {
        const { id } = req.params;

        const promocion = await Promocion.findByPk(id, {
            include: [
                {
                    model: Producto,
                    as: 'productos',
                    through: { attributes: [] },
                    attributes: ['id', 'nombre', 'precio', 'imagen_url', 'slug', 'stock']
                }
            ]
        });

        if (!promocion) {
            return res.status(404).json({ error: 'Promotion not found' });
        }

        res.json(promocion);
    } catch (error) {
        logger.error('Error fetching promotion:', error);
        res.status(500).json({ error: 'Error fetching the promotion' });
        res.status(500).json({ error: 'Error fetching the promotion' });
    }
};

/**
 * Create new promotion
 */
exports.crear = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
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
            productos_ids
        } = req.body;

        // Validaciones
        if (!nombre || !titulo || !tipo_descuento || !valor_descuento || !fecha_inicio || !fecha_fin) {
            return res.status(400).json({ 
                error: 'Faltan campos requeridos: nombre, titulo, tipo_descuento, valor_descuento, fecha_inicio, fecha_fin' 
            });
        }

        // Validar fechas
        if (new Date(fecha_fin) <= new Date(fecha_inicio)) {
            return res.status(400).json({ error: 'La fecha de fin debe ser posterior a la fecha de inicio' });
        }

        // Validar descuento
        if (tipo_descuento === 'porcentaje' && valor_descuento > 100) {
            return res.status(400).json({ error: 'El descuento por porcentaje no puede ser mayor a 100%' });
        }

        if (valor_descuento < 0) {
            return res.status(400).json({ error: 'El valor del descuento no puede ser negativo' });
        }

        // Validate unique code if provided
        if (codigo) {
            const existeCodigo = await Promocion.findOne({ 
                where: { codigo: codigo.toUpperCase() },
                transaction 
            });
            if (existeCodigo) {
                return res.status(400).json({ error: 'Promotion code already exists' });
            }
        }

        // Create promotion
        const promocion = await Promocion.create({
            codigo: codigo ? codigo.toUpperCase() : null,
            nombre,
            titulo,
            descripcion,
            tipo: tipo || 'producto',
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
            estado: estado || 'programado',
            aplica_acumulacion: aplica_acumulacion || false,
            metadata_visual: metadata_visual || {
                badge: { texto: 'OFERTA', posicion: 'top-right', animacion: 'pulse' },
                gradiente: ['#FF6B6B', '#FF8E53'],
                badge_color: '#FF0000',
                mostrar_countdown: true,
                mostrar_ahorro: true
            },
            reglas_aplicacion: reglas_aplicacion || {
                productos_ids: [],
                categorias_ids: [],
                excluir_productos_ids: [],
                minimo_cantidad: 1
            },
            creado_por: req.user ? req.user.id : null
        }, { transaction });

        // Associate products if provided
        if (productos_ids && Array.isArray(productos_ids) && productos_ids.length > 0) {
            // Validate that products exist
            const productos = await Producto.findAll({
                where: { id: { [Op.in]: productos_ids } },
                transaction
            });

            if (productos.length !== productos_ids.length) {
                throw new Error('Algunos productos no existen');
            }

            await promocion.addProductos(productos, { transaction });
        }

        await transaction.commit();

        // Reload with products
        const promocionCompleta = await Promocion.findByPk(promocion.id, {
            include: [
                {
                    model: Producto,
                    as: 'productos',
                    through: { attributes: [] },
                    attributes: ['id', 'nombre', 'precio', 'imagen_url', 'slug']
                }
            ]
        });

        res.status(201).json(promocionCompleta);
    } catch (error) {
        await transaction.rollback();
        logger.error('Error creating promotion:', error);
        res.status(500).json({ error: error.message || 'Error creating the promotion' });
        res.status(500).json({ error: error.message || 'Error creating the promotion' });
    }
};

/**
 * Update existing promotion
 */
exports.actualizar = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;
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
            productos_ids
        } = req.body;

        const promocion = await Promocion.findByPk(id, { transaction });

        if (!promocion) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Promotion not found' });
        }

        // Validate dates if provided
        const nuevaFechaInicio = fecha_inicio || promocion.fecha_inicio;
        const nuevaFechaFin = fecha_fin || promocion.fecha_fin;

        if (new Date(nuevaFechaFin) <= new Date(nuevaFechaInicio)) {
            await transaction.rollback();
            return res.status(400).json({ error: 'La fecha de fin debe ser posterior a la fecha de inicio' });
        }

        // Validate unique code if updating
        if (codigo && codigo !== promocion.codigo) {
            const existeCodigo = await Promocion.findOne({ 
                where: { 
                    codigo: codigo.toUpperCase(),
                    id: { [Op.ne]: id }
                },
                transaction 
            });
            if (existeCodigo) {
                await transaction.rollback();
                return res.status(400).json({ error: 'Promotion code already exists' });
            }
        }

        // Update fields
        await promocion.update({
            codigo: codigo ? codigo.toUpperCase() : promocion.codigo,
            nombre: nombre || promocion.nombre,
            titulo: titulo || promocion.titulo,
            descripcion: descripcion !== undefined ? descripcion : promocion.descripcion,
            tipo: tipo || promocion.tipo,
            tipo_descuento: tipo_descuento || promocion.tipo_descuento,
            valor_descuento: valor_descuento !== undefined ? valor_descuento : promocion.valor_descuento,
            descuento_maximo: descuento_maximo !== undefined ? descuento_maximo : promocion.descuento_maximo,
            fecha_inicio: nuevaFechaInicio,
            fecha_fin: nuevaFechaFin,
            cantidad_usos_maximos: cantidad_usos_maximos !== undefined ? cantidad_usos_maximos : promocion.cantidad_usos_maximos,
            usos_por_usuario: usos_por_usuario || promocion.usos_por_usuario,
            minimo_puntos: minimo_puntos !== undefined ? minimo_puntos : promocion.minimo_puntos,
            requiere_codigo: requiere_codigo !== undefined ? requiere_codigo : promocion.requiere_codigo,
            prioridad: prioridad !== undefined ? prioridad : promocion.prioridad,
            estado: estado || promocion.estado,
            aplica_acumulacion: aplica_acumulacion !== undefined ? aplica_acumulacion : promocion.aplica_acumulacion,
            metadata_visual: metadata_visual || promocion.metadata_visual,
            reglas_aplicacion: reglas_aplicacion || promocion.reglas_aplicacion
        }, { transaction });

        // Update associated products if provided
        if (productos_ids !== undefined && Array.isArray(productos_ids)) {
            // Remove existing associations
            await PromocionProducto.destroy({
                where: { promocion_id: id },
                transaction
            });

            // Create new associations
            if (productos_ids.length > 0) {
                const productos = await Producto.findAll({
                    where: { id: { [Op.in]: productos_ids } },
                    transaction
                });

                if (productos.length !== productos_ids.length) {
                    throw new Error('Algunos productos no existen');
                }

                await promocion.addProductos(productos, { transaction });
            }
        }

        await transaction.commit();

        // Reload with products
        const promocionActualizada = await Promocion.findByPk(id, {
            include: [
                {
                    model: Producto,
                    as: 'productos',
                    through: { attributes: [] },
                    attributes: ['id', 'nombre', 'precio', 'imagen_url', 'slug']
                }
            ]
        });

        res.json(promocionActualizada);
    } catch (error) {
        await transaction.rollback();
        logger.error('Error updating promotion:', error);
        res.status(500).json({ error: error.message || 'Error updating the promotion' });
        res.status(500).json({ error: error.message || 'Error updating the promotion' });
    }
};

/**
 * Delete promotion
 */
exports.eliminar = async (req, res) => {
    try {
        const { id } = req.params;

        const promocion = await Promocion.findByPk(id);

        if (!promocion) {
            return res.status(404).json({ error: 'Promotion not found' });
        }

        // Instead of physically deleting, mark as inactive
        await promocion.update({ estado: 'inactivo' });

        res.json({ mensaje: 'Promotion deleted successfully' });
    } catch (error) {
        logger.error('Error deleting promotion:', error);
        res.status(500).json({ error: 'Error deleting the promotion' });
        res.status(500).json({ error: 'Error deleting the promotion' });
    }
};

/**
 * Permanently delete a promotion
 */
exports.eliminarPermanente = async (req, res) => {
    try {
        const { id } = req.params;

        const promocion = await Promocion.findByPk(id);

        if (!promocion) {
            return res.status(404).json({ error: 'Promotion not found' });
        }

        await promocion.destroy();

        res.json({ mensaje: 'Promotion permanently deleted' });
    } catch (error) {
        logger.error('Error deleting promotion:', error);
        res.status(500).json({ error: 'Error deleting the promotion' });
        res.status(500).json({ error: 'Error deleting the promotion' });
    }
};

/**
 * Get promotion statistics
 */
exports.obtenerEstadisticas = async (req, res) => {
    try {
        const { id } = req.params;
        const estadisticas = await promocionService.obtenerEstadisticasPromocion(id);
        res.json(estadisticas);
    } catch (error) {
        logger.error('Error fetching stats:', error);
        res.status(500).json({ error: error.message || 'Error fetching stats' });
        res.status(500).json({ error: error.message || 'Error fetching stats' });
    }
};

/**
 * Validate promotion code
 */
exports.validarCodigo = async (req, res) => {
    try {
        const { codigo, producto_id } = req.body;
        const usuarioId = req.user ? req.user.id : null;

        if (!codigo) {
            return res.status(400).json({ error: 'Code is required' });
        }

        const resultado = await promocionService.validarCodigoPromocion(codigo, producto_id, usuarioId);

        if (!resultado.valido) {
            return res.status(400).json({ 
                valido: false, 
                mensaje: resultado.mensaje 
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
                metadata_visual: resultado.promocion.metadata_visual
            }
        });
    } catch (error) {
        logger.error('Error validating code:', error);
        res.status(500).json({ error: 'Error validating the code' });
        res.status(500).json({ error: 'Error validating the code' });
    }
};

/**
 * Get active promotions (public)
 */
exports.obtenerPromocionesActivas = async (req, res) => {
    try {
        const promociones = await promocionService.obtenerPromocionesActivas();
        
        // Filter sensitive information
        const promocionesPublicas = promociones.map(promo => ({
            id: promo.id,
            titulo: promo.titulo,
            descripcion: promo.descripcion,
            tipo_descuento: promo.tipo_descuento,
            valor_descuento: promo.valor_descuento,
            fecha_fin: promo.fecha_fin,
            metadata_visual: promo.metadata_visual,
            productos: promo.productos.map(p => ({
                id: p.id,
                nombre: p.nombre,
                precio: p.precio,
                imagen_url: p.imagen_url,
                slug: p.slug
            }))
        }));

        res.json(promocionesPublicas);
    } catch (error) {
        logger.error('Error fetching active promotions:', error);
        res.status(500).json({ error: 'Error fetching active promotions' });

    }
};

/**
 * Update promotion states (scheduled task or manual)
 */
exports.actualizarEstados = async (req, res) => {
    try {
        await promocionService.actualizarEstadosPromociones();
        res.json({ mensaje: 'Promotion states updated successfully' });
    } catch (error) {
        logger.error('Error updating states:', error);
        res.status(500).json({ error: 'Error updating states' });
    }
};

/**
 * Export promotions to PDF
 */
exports.exportarPDF = async (req, res) => {
    try {
        const { estado, activas_solo } = req.query;
        const where = {};

        if (estado) {
            where.estado = estado;
        }

        if (activas_solo === 'true') {
            const ahora = new Date();
            where.estado = 'activo';
            where.fecha_inicio = { [Op.lte]: ahora };
            where.fecha_fin = { [Op.gte]: ahora };
        }

        // Separate queries to avoid GROUP BY issues
        const promociones = await Promocion.findAll({
            where,
            include: [
                {
                    model: Producto,
                    as: 'productos',
                    through: { attributes: [] },
                    attributes: ['id', 'nombre', 'precio']
                }
            ],
            order: [['estado', 'ASC'], ['prioridad', 'DESC']]
        });

        logger.info(`[PDF Export] Total promotions found: ${promociones.length}`);

        // Get usage statistics separately and prepare data
        const promocionesConEstadisticas = [];
        
        for (const promocion of promociones) {
            const estadisticas = await UsoPromocion.findOne({
                where: { promocion_id: promocion.id },
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('id')), 'total_usos'],
                    [sequelize.fn('SUM', sequelize.col('descuento_aplicado')), 'puntos_descontados']
                ],
                raw: true
            });

            // Convert to plain object for easier PDF access
            const promocionData = {
                ...promocion.toJSON(),
                total_usos: parseInt(estadisticas?.total_usos) || 0,
                puntos_descontados: parseInt(estadisticas?.puntos_descontados) || 0
            };

            promocionesConEstadisticas.push(promocionData);
        }

        logger.debug('[PDF Export] Sample data:', promocionesConEstadisticas[0]);

        // Import PDF utility
        const generarPDFPromociones = require('../utils/promociones.pdf');
        
        const pdfBuffer = await generarPDFPromociones(promocionesConEstadisticas);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=promociones-${Date.now()}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        logger.error('Error exporting PDF:', error);
        res.status(500).json({ error: 'Error generating PDF' });
    }
};

/**
 * Assign promotions to a product
 */
exports.asignarProductos = async (req, res) => {
    try {
        const { promocionId } = req.params;
        const { producto_ids } = req.body; // Array of product IDs

        if (!Array.isArray(producto_ids)) {
            return res.status(400).json({ error: 'producto_ids must be an array' });
        }

        const promocion = await Promocion.findByPk(promocionId);
        if (!promocion) {
            return res.status(404).json({ error: 'Promotion not found' });
        }

        // Remove previous assignments
        await PromocionProducto.destroy({
            where: { promocion_id: promocionId }
        });

        // Create new assignments
        if (producto_ids.length > 0) {
            const asignaciones = producto_ids.map(producto_id => ({
                promocion_id: promocionId,
                producto_id
            }));

            await PromocionProducto.bulkCreate(asignaciones, {
                ignoreDuplicates: true
            });
        }

        res.json({ 
            message: 'Products assigned successfully',
            promocion_id: promocionId,
            productos_asignados: producto_ids.length
        });

    } catch (error) {
        logger.error('Error assigning products:', error);
        res.status(500).json({ error: 'Error assigning products to the promotion' });
    }
};

/**
 * Unassign a product from a promotion
 */
exports.desasignarProducto = async (req, res) => {
    try {
        const { promocionId, productoId } = req.params;

        const deleted = await PromocionProducto.destroy({
            where: {
                promocion_id: promocionId,
                producto_id: productoId
            }
        });

        if (deleted === 0) {
            return res.status(404).json({ error: 'Relation not found' });
        }

        res.json({ 
            message: 'Product unassigned successfully',
            promocion_id: promocionId,
            producto_id: productoId
        });

    } catch (error) {
        logger.error('Error unassigning product:', error);
        res.status(500).json({ error: 'Error unassigning product' });
    }
};

/**
 * Get promotions for a specific product
 */
exports.obtenerPromocionesProducto = async (req, res) => {
    try {
        const { productoId } = req.params;

        const producto = await Producto.findByPk(productoId);
        if (!producto) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const promociones = await Promocion.findAll({
            include: [
                {
                    model: Producto,
                    as: 'productos',
                    where: { id: productoId },
                    through: { attributes: [] },
                    required: true
                }
            ],
            order: [['prioridad', 'DESC'], ['fecha_inicio', 'DESC']]
        });

        res.json(promociones);

    } catch (error) {
        logger.error('Error fetching product promotions:', error);
        res.status(500).json({ error: 'Error fetching promotions' });

    }
};

module.exports = exports;
