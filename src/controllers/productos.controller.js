const { Producto, sequelize } = require('../models');

// Listar todos (con orden por precio; por defecto DESC). Para público, usualmente solo publicados.
exports.listar = async (req, res) => {
    const where = {};

    // Debug: Log información del usuario
    console.log('🔍 [PRODUCTOS DEBUG] Usuario autenticado:', {
        user: req.user ? {
            id: req.user.id,
            nickname: req.user.nickname,
            rol_id: req.user.rol_id
        } : 'NO AUTENTICADO',
        isAdmin: req.user && req.user.rol_id > 2
    });

    if (!req.user || req.user.rol_id <= 2) {
        // Usuario no logueado o usuarios básicos (rol 1-2) solo ven productos publicados
        where.estado = 'publicado';
        console.log('🔍 [PRODUCTOS DEBUG] Aplicando filtro: solo productos publicados');
    } else {
        console.log('🔍 [PRODUCTOS DEBUG] Usuario administrador: mostrando todos los productos');
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

    // Debug: Log productos encontrados
    console.log('🔍 [PRODUCTOS DEBUG] Productos encontrados:', {
        total: productos.length,
        productos: productos.map(p => ({
            id: p.id,
            nombre: p.nombre,
            estado: p.estado,
            precio: p.precio
        }))
    });

    res.json(productos);
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
    res.json(producto);
};

exports.crear = async (req, res) => {
    try {
        // Debug: Log datos recibidos
        console.log('🔍 [PRODUCTOS DEBUG] Creando producto:', {
            usuario: req.user ? {
                id: req.user.id,
                nickname: req.user.nickname,
                rol_id: req.user.rol_id
            } : 'NO AUTENTICADO',
            datos: req.body
        });

        const producto = await Producto.create(req.body);

        // Debug: Log producto creado
        console.log('🔍 [PRODUCTOS DEBUG] Producto creado exitosamente:', {
            id: producto.id,
            nombre: producto.nombre,
            estado: producto.estado,
            precio: producto.precio
        });

        res.status(201).json(producto);
    } catch (err) {
        console.error('❌ [PRODUCTOS DEBUG] Error creando producto:', err.message);
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

        console.log('🔍 [DEBUG] Todos los productos en DB:', productos.length);

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
exports.listarAdmin = async (_req, res) => {
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
    res.json(productos);
};

