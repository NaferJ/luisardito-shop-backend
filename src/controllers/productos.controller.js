const { Producto } = require('../models');

// Listar todos (con orden por precio; por defecto DESC). Para público, usualmente solo publicados.
exports.listar = async (req, res) => {
    const where = {};

    // Solo streamers, developers y moderadores (rol_id >= 3) pueden ver todos los productos
    // Usuarios no logueados y usuarios básicos/suscriptores solo ven productos publicados
    if (!req.user || req.user.rol_id <= 2) {
        where.estado = 'publicado';
    }
    // Si es streamer/developer/moderador (rol_id >= 3), ve todos los productos

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

    const productos = await Producto.findAll({ where, order });
    res.json(productos);
};

exports.obtener = async (req, res) => {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) return res.status(404).json({ error: 'No encontrado' });
    res.json(producto);
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
