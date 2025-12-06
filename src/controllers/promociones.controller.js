const { Promocion, PromocionProducto, UsoPromocion, Producto, sequelize } = require('../models');
const promocionService = require('../services/promocion.service');
const { Op } = require('sequelize');

/**
 * Listar todas las promociones con filtros
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
        console.error('Error al listar promociones:', error);
        res.status(500).json({ error: 'Error al obtener promociones' });
    }
};

/**
 * Obtener una promoción por ID
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
            return res.status(404).json({ error: 'Promoción no encontrada' });
        }

        res.json(promocion);
    } catch (error) {
        console.error('Error al obtener promoción:', error);
        res.status(500).json({ error: 'Error al obtener la promoción' });
    }
};

/**
 * Crear nueva promoción
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

        // Validar código único si se proporciona
        if (codigo) {
            const existeCodigo = await Promocion.findOne({ 
                where: { codigo: codigo.toUpperCase() },
                transaction 
            });
            if (existeCodigo) {
                return res.status(400).json({ error: 'El código de promoción ya existe' });
            }
        }

        // Crear promoción
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

        // Asociar productos si se proporcionan
        if (productos_ids && Array.isArray(productos_ids) && productos_ids.length > 0) {
            // Validar que los productos existen
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

        // Recargar con productos
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
        console.error('Error al crear promoción:', error);
        res.status(500).json({ error: error.message || 'Error al crear la promoción' });
    }
};

/**
 * Actualizar promoción existente
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
            return res.status(404).json({ error: 'Promoción no encontrada' });
        }

        // Validar fechas si se proporcionan
        const nuevaFechaInicio = fecha_inicio || promocion.fecha_inicio;
        const nuevaFechaFin = fecha_fin || promocion.fecha_fin;

        if (new Date(nuevaFechaFin) <= new Date(nuevaFechaInicio)) {
            await transaction.rollback();
            return res.status(400).json({ error: 'La fecha de fin debe ser posterior a la fecha de inicio' });
        }

        // Validar código único si se actualiza
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
                return res.status(400).json({ error: 'El código de promoción ya existe' });
            }
        }

        // Actualizar campos
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

        // Actualizar productos asociados si se proporcionan
        if (productos_ids !== undefined && Array.isArray(productos_ids)) {
            // Eliminar asociaciones existentes
            await PromocionProducto.destroy({
                where: { promocion_id: id },
                transaction
            });

            // Crear nuevas asociaciones
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

        // Recargar con productos
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
        console.error('Error al actualizar promoción:', error);
        res.status(500).json({ error: error.message || 'Error al actualizar la promoción' });
    }
};

/**
 * Eliminar promoción
 */
exports.eliminar = async (req, res) => {
    try {
        const { id } = req.params;

        const promocion = await Promocion.findByPk(id);

        if (!promocion) {
            return res.status(404).json({ error: 'Promoción no encontrada' });
        }

        // En lugar de eliminar físicamente, marcar como inactivo
        await promocion.update({ estado: 'inactivo' });

        res.json({ mensaje: 'Promoción eliminada exitosamente' });
    } catch (error) {
        console.error('Error al eliminar promoción:', error);
        res.status(500).json({ error: 'Error al eliminar la promoción' });
    }
};

/**
 * Eliminar permanentemente una promoción
 */
exports.eliminarPermanente = async (req, res) => {
    try {
        const { id } = req.params;

        const promocion = await Promocion.findByPk(id);

        if (!promocion) {
            return res.status(404).json({ error: 'Promoción no encontrada' });
        }

        await promocion.destroy();

        res.json({ mensaje: 'Promoción eliminada permanentemente' });
    } catch (error) {
        console.error('Error al eliminar promoción permanentemente:', error);
        res.status(500).json({ error: 'Error al eliminar la promoción' });
    }
};

/**
 * Obtener estadísticas de una promoción
 */
exports.obtenerEstadisticas = async (req, res) => {
    try {
        const { id } = req.params;
        const estadisticas = await promocionService.obtenerEstadisticasPromocion(id);
        res.json(estadisticas);
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ error: error.message || 'Error al obtener estadísticas' });
    }
};

/**
 * Validar código de promoción
 */
exports.validarCodigo = async (req, res) => {
    try {
        const { codigo, producto_id } = req.body;
        const usuarioId = req.user ? req.user.id : null;

        if (!codigo) {
            return res.status(400).json({ error: 'El código es requerido' });
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
        console.error('Error al validar código:', error);
        res.status(500).json({ error: 'Error al validar el código' });
    }
};

/**
 * Obtener promociones activas (público)
 */
exports.obtenerPromocionesActivas = async (req, res) => {
    try {
        const promociones = await promocionService.obtenerPromocionesActivas();
        
        // Filtrar información sensible
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
        console.error('Error al obtener promociones activas:', error);
        res.status(500).json({ error: 'Error al obtener promociones activas' });
    }
};

/**
 * Actualizar estados de promociones (tarea programada o manual)
 */
exports.actualizarEstados = async (req, res) => {
    try {
        await promocionService.actualizarEstadosPromociones();
        res.json({ mensaje: 'Estados de promociones actualizados correctamente' });
    } catch (error) {
        console.error('Error al actualizar estados:', error);
        res.status(500).json({ error: 'Error al actualizar los estados' });
    }
};

/**
 * Exportar promociones a PDF
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

        const promociones = await Promocion.findAll({
            where,
            include: [
                {
                    model: Producto,
                    as: 'productos',
                    through: { attributes: [] },
                    attributes: ['id', 'nombre', 'precio']
                },
                {
                    model: UsoPromocion,
                    as: 'usos',
                    attributes: []
                }
            ],
            attributes: {
                include: [
                    [sequelize.fn('COUNT', sequelize.col('usos.id')), 'total_usos'],
                    [sequelize.fn('SUM', sequelize.col('usos.descuento_aplicado')), 'puntos_descontados']
                ]
            },
            group: ['Promocion.id'],
            order: [['estado', 'ASC'], ['prioridad', 'DESC']]
        });

        // Importar utilidad PDF
        const generarPDFPromociones = require('../utils/promociones.pdf');
        
        const pdfBuffer = await generarPDFPromociones(promociones);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=promociones-${Date.now()}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error al exportar PDF:', error);
        res.status(500).json({ error: 'Error al generar el PDF' });
    }
};

/**
 * Asignar promociones a un producto
 */
exports.asignarProductos = async (req, res) => {
    try {
        const { promocionId } = req.params;
        const { producto_ids } = req.body; // Array de IDs de productos

        if (!Array.isArray(producto_ids)) {
            return res.status(400).json({ error: 'producto_ids debe ser un array' });
        }

        const promocion = await Promocion.findByPk(promocionId);
        if (!promocion) {
            return res.status(404).json({ error: 'Promoción no encontrada' });
        }

        // Eliminar asignaciones anteriores
        await PromocionProducto.destroy({
            where: { promocion_id: promocionId }
        });

        // Crear nuevas asignaciones
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
            message: 'Productos asignados correctamente',
            promocion_id: promocionId,
            productos_asignados: producto_ids.length
        });

    } catch (error) {
        console.error('Error al asignar productos:', error);
        res.status(500).json({ error: 'Error al asignar productos a la promoción' });
    }
};

/**
 * Desasignar un producto de una promoción
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
            return res.status(404).json({ error: 'Relación no encontrada' });
        }

        res.json({ 
            message: 'Producto desasignado correctamente',
            promocion_id: promocionId,
            producto_id: productoId
        });

    } catch (error) {
        console.error('Error al desasignar producto:', error);
        res.status(500).json({ error: 'Error al desasignar producto' });
    }
};

/**
 * Obtener promociones de un producto específico
 */
exports.obtenerPromocionesProducto = async (req, res) => {
    try {
        const { productoId } = req.params;

        const producto = await Producto.findByPk(productoId);
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
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
        console.error('Error al obtener promociones del producto:', error);
        res.status(500).json({ error: 'Error al obtener promociones' });
    }
};

module.exports = exports;
