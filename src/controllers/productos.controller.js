const { Producto, Promocion, sequelize } = require('../models');
const { Op } = require('sequelize');
const promocionService = require('../services/promocion.service');

// Listar todos (con orden por precio; por defecto DESC). Para público, usualmente solo publicados.
exports.listar = async (req, res) => {
    const where = {};

    if (!req.user || req.user.rol_id <= 2) {
        // Usuario no logueado o usuarios básicos (rol 1-2) solo ven productos publicados
        where.estado = 'publicado';
    } else {

    }

    // Soporte de orden: ?sort=price_desc | price_asc | precio_desc | precio_asc
    const sortParam = (req.query.sort || '').toString().toLowerCase();
    let order;
    switch (sortParam) {
        case 'price_asc':
        case 'precio_asc':
            order = [['precio', 'ASC']];
            break;
        case 'price_desc':
        case 'precio_desc':
        default:
            order = [['precio', 'DESC']];
            break;
    }

    const productos = await Producto.findAll({
        where,
        order,
        attributes: {
            include: [
                [
                    sequelize.literal("(SELECT COUNT(*) FROM canjes c WHERE c.producto_id = Producto.id AND c.estado != 'devuelto')"),
                    'canjes_count'
                ]
            ]
        }
    });

    // Agregar información de descuentos a cada producto
    const usuarioId = req.user ? req.user.id : null;
    const productosConDescuentos = await Promise.all(
        productos.map(async (producto) => {
            const infoDescuento = await promocionService.calcularMejorDescuento(
                producto.id,
                producto.precio,
                usuarioId
            );

            const promocionesActivas = await promocionService.obtenerPromocionesActivasProducto(producto.id, usuarioId);

            return {
                ...producto.toJSON(),
                descuento: infoDescuento,
                promociones_activas: promocionesActivas.map(p => ({
                    id: p.id,
                    codigo: p.codigo,
                    titulo: p.titulo,
                    tipo_descuento: p.tipo_descuento,
                    valor_descuento: p.valor_descuento
                })),
                promocion_id: infoDescuento.promocion ? infoDescuento.promocion.id : null
            };
        })
    );

    res.json(productosConDescuentos);
};

exports.obtener = async (req, res) => {
    const producto = await Producto.findByPk(req.params.id, {
        attributes: {
            include: [
                [
                    sequelize.literal("(SELECT COUNT(*) FROM canjes c WHERE c.producto_id = Producto.id AND c.estado != 'devuelto')"),
                    'canjes_count'
                ]
            ]
        }
    });
    if (!producto) return res.status(404).json({ error: 'No encontrado' });

    // Agregar información de descuento
    const usuarioId = req.user ? req.user.id : null;
    const infoDescuento = await promocionService.calcularMejorDescuento(
        producto.id,
        producto.precio,
        usuarioId
    );

    // Obtener promociones activas del producto
    const promocionesActivas = await promocionService.obtenerPromocionesActivasProducto(producto.id, usuarioId);

    res.json({
        ...producto.toJSON(),
        descuento: infoDescuento,
        promociones_activas: promocionesActivas.map(p => ({
            id: p.id,
            codigo: p.codigo,
            titulo: p.titulo,
            descripcion: p.descripcion,
            tipo_descuento: p.tipo_descuento,
            valor_descuento: p.valor_descuento,
            fecha_fin: p.fecha_fin,
            metadata_visual: p.metadata_visual,
            requiere_codigo: p.requiere_codigo
        })),
        promocion_id: infoDescuento.promocion ? infoDescuento.promocion.id : null
    });
};

exports.obtenerPorSlug = async (req, res) => {
    try {
        const { slug } = req.params;
        let where = { slug };

        if (!req.user || req.user.rol_id <= 2) {
            where.estado = 'publicado';
        } else {
            where.estado = { [Op.in]: ['publicado', 'borrador'] };
        }

        const producto = await Producto.findOne({
            where,
            attributes: {
                include: [
                    [
                        sequelize.literal("(SELECT COUNT(*) FROM canjes c WHERE c.producto_id = Producto.id AND c.estado != 'devuelto')"),
                        'canjes_count'
                    ]
                ]
            }
        });

        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        // Agregar información de descuento
        const usuarioId = req.user ? req.user.id : null;
        const infoDescuento = await promocionService.calcularMejorDescuento(
            producto.id,
            producto.precio,
            usuarioId
        );

        // Obtener promociones activas del producto
        const promocionesActivas = await promocionService.obtenerPromocionesActivasProducto(producto.id, usuarioId);

        res.json({
            ...producto.toJSON(),
            descuento: infoDescuento,
            promociones_activas: promocionesActivas.map(p => ({
                id: p.id,
                codigo: p.codigo,
                titulo: p.titulo,
                descripcion: p.descripcion,
                tipo_descuento: p.tipo_descuento,
                valor_descuento: p.valor_descuento,
                fecha_fin: p.fecha_fin,
                metadata_visual: p.metadata_visual,
                requiere_codigo: p.requiere_codigo
            })),
            promocion_id: infoDescuento.promocion ? infoDescuento.promocion.id : null
        });
    } catch (error) {
        console.error('Error al buscar producto por slug:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

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
        if (!producto) return res.status(404).json({ error: 'No encontrado' });
        await producto.update(req.body);
        res.json(producto);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.eliminar = async (req, res) => {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) return res.status(404).json({ error: 'No encontrado' });
    await producto.destroy();
    res.json({ message: 'Producto eliminado' });
};

/**
 * Actualizar promociones de un producto
 */
exports.actualizarPromociones = async (req, res) => {
    try {
        const { id } = req.params;
        const { promocion_ids } = req.body; // Array de IDs de promociones a asignar

        if (!Array.isArray(promocion_ids)) {
            return res.status(400).json({ error: 'promocion_ids debe ser un array' });
        }

        const producto = await Producto.findByPk(id);
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const { PromocionProducto } = require('../models');

        // Para cada promoción seleccionada, actualizar su lista de productos
        // Primero obtenemos todas las promociones activas
        const todasPromociones = await Promocion.findAll({
            attributes: ['id']
        });

        for (const promo of todasPromociones) {
            const debeEstar = promocion_ids.includes(promo.id);
            const estaAsignado = await PromocionProducto.findOne({
                where: {
                    promocion_id: promo.id,
                    producto_id: id
                }
            });

            if (debeEstar && !estaAsignado) {
                // Agregar relación
                await PromocionProducto.create({
                    promocion_id: promo.id,
                    producto_id: id
                });
            } else if (!debeEstar && estaAsignado) {
                // Eliminar relación
                await estaAsignado.destroy();
            }
        }

        res.json({
            message: 'Promociones actualizadas correctamente',
            producto_id: id,
            promociones_asignadas: promocion_ids
        });

    } catch (error) {
        console.error('Error al actualizar promociones del producto:', error);
        res.status(500).json({ error: 'Error al actualizar promociones' });
    }
};

// Endpoint de debug para ver todos los productos sin filtros
exports.debugListar = async (req, res) => {
    try {
        const productos = await Producto.findAll({
            order: [['id', 'ASC']],
            attributes: {
                include: [
                    [
                        sequelize.literal("(SELECT COUNT(*) FROM canjes c WHERE c.producto_id = Producto.id AND c.estado != 'devuelto')"),
                        'canjes_count'
                    ]
                ]
            }
        });

        res.json({
            total: productos.length,
            productos: productos.map(p => ({
                id: p.id,
                nombre: p.nombre,
                estado: p.estado,
                precio: p.precio,
                stock: p.stock,
                canjes_count: (p.get ? p.get('canjes_count') : p.canjes_count),
                creado: p.creado,
                actualizado: p.actualizado
            }))
        });
    } catch (error) {
        console.error('❌ [DEBUG] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// Endpoint ADMIN: lista todos los productos con canjes_count (requiere auth/permiso a nivel de ruta)
exports.listarAdmin = async (req, res) => {
    // Soporte de orden como en público
    const sortParam = (req.query.sort || '').toString().toLowerCase();
    let order;
    switch (sortParam) {
        case 'price_asc':
        case 'precio_asc':
            order = [['precio', 'ASC']];
            break;
        case 'price_desc':
        case 'precio_desc':
        default:
            order = [['precio', 'DESC']];
            break;
    }

    const productos = await Producto.findAll({
        order,
        attributes: {
            include: [
                [
                    sequelize.literal("(SELECT COUNT(*) FROM canjes c WHERE c.producto_id = Producto.id AND c.estado != 'devuelto')"),
                    'canjes_count'
                ]
            ]
        }
    });

    // Agregar información de descuentos a cada producto
    // ⚠️ ADMIN: No filtrar por usuario - mostrar todas las promociones del producto
    const productosConDescuentos = await Promise.all(
        productos.map(async (producto) => {
            const infoDescuento = await promocionService.calcularMejorDescuento(
                producto.id,
                producto.precio,
                null  // null = no filtrar por usuario
            );

            const promocionesActivas = await promocionService.obtenerPromocionesActivasProducto(producto.id, null);

            return {
                ...producto.toJSON(),
                descuento: infoDescuento,
                promociones_activas: promocionesActivas.map(p => ({
                    id: p.id,
                    codigo: p.codigo,
                    titulo: p.titulo,
                    tipo_descuento: p.tipo_descuento,
                    valor_descuento: p.valor_descuento
                })),
                promocion_id: infoDescuento.promocion ? infoDescuento.promocion.id : null
            };
        })
    );

    res.json(productosConDescuentos);
};
