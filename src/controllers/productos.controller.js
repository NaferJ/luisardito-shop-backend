const { Producto } = require('../models');

// Listar todos (solo publicados para usuarios)
exports.listar = async (req, res) => {
    const where = {};
    if (!req.user || req.user.rol_id > 2) {
        // streamer/developer ve todo
    } else {
        where.estado = 'publicado';
    }
    const productos = await Producto.findAll({ where });
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
