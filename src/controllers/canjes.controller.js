const { Canje, Producto, Usuario, HistorialPunto } = require('../models');

exports.crear = async (req, res) => {
    try {
        const user = req.user;
        const { producto_id } = req.body;
        const producto = await Producto.findByPk(producto_id);
        if (!producto || producto.estado !== 'publicado') {
            return res.status(404).json({ error: 'Producto no disponible' });
        }
        if (user.puntos < producto.precio) {
            return res.status(400).json({ error: 'Puntos insuficientes' });
        }
        // Crear canje
        const canje = await Canje.create({ usuario_id: user.id, producto_id });
        // Restar puntos y registrar historial
        user.puntos -= producto.precio;
        await user.save();
        await HistorialPunto.create({
            usuario_id: user.id,
            cambio:     -producto.precio,
            motivo:     `Canje producto ${producto.nombre}`
        });
        res.status(201).json(canje);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.listar = async (req, res) => {
    const filtros = {};
    if (req.user.rol_id > 2) {
        filtros.usuario_id = req.user.id;
    }
    const canjes = await Canje.findAll({
        where: filtros,
        include: ['Usuario','Producto']
    });
    res.json(canjes);
};

exports.actualizarEstado = async (req, res) => {
    try {
        const canje = await Canje.findByPk(req.params.id);
        if (!canje) return res.status(404).json({ error: 'No encontrado' });
        await canje.update({ estado: req.body.estado });
        res.json(canje);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};
