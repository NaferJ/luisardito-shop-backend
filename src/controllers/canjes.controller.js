const { Canje, Producto, Usuario, HistorialPunto } = require('../models');

exports.crear = async (req, res) => {
    const t = await Canje.sequelize.transaction();
    try {
        const { producto_id } = req.body;
        const usuarioId = req.user.id;

        const producto = await Producto.findByPk(producto_id, { transaction: t, lock: t.LOCK.UPDATE });
        if (!producto || producto.estado !== 'publicado') {
            await t.rollback();
            return res.status(404).json({ error: 'Producto no disponible' });
        }
        const stockActual = Number.isFinite(producto.stock) ? producto.stock : 0;
        if (stockActual <= 0) {
            await t.rollback();
            return res.status(400).json({ error: 'Sin stock disponible para este producto' });
        }

        const usuario = await Usuario.findByPk(usuarioId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!usuario) {
            await t.rollback();
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        if (usuario.puntos < producto.precio) {
            await t.rollback();
            return res.status(400).json({ error: 'Puntos insuficientes' });
        }

        // 2) Crear canje
        const canje = await Canje.create({ usuario_id: usuario.id, producto_id }, { transaction: t });

        // 3) Descontar stock del producto
        await producto.update({ stock: stockActual - 1 }, { transaction: t });

        // 4) Restar puntos al usuario
        const puntosNuevos = usuario.puntos - producto.precio;
        await usuario.update({ puntos: puntosNuevos }, { transaction: t });

        // 5) Registrar historial de puntos
        await HistorialPunto.create({
            usuario_id: usuario.id,
            puntos: -producto.precio,  // Cantidad negativa porque se gastan puntos
            cambio: -producto.precio,  // Campo legacy para compatibilidad
            tipo: 'gastado',
            concepto: `Canje producto: ${producto.nombre}`,
            motivo: `Canje producto ${producto.nombre}`  // Campo legacy para compatibilidad
        }, { transaction: t });

        await t.commit();
        res.status(201).json(canje);
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
};

exports.listar = async (req, res) => {
    // Ruta protegida por permiso('gestionar_canjes'): devolver todos los canjes
    const canjes = await Canje.findAll({
        where: {},
        include: [Usuario, Producto],
        order: [['fecha', 'DESC']]
    });
    res.json(canjes);
};

// Listar únicamente los canjes del usuario autenticado (para "Mis Canjes")
exports.listarMios = async (req, res) => {
    const canjes = await Canje.findAll({
        where: { usuario_id: req.user.id },
        include: [Usuario, Producto],
        order: [['fecha', 'DESC']]
    });
    res.json(canjes);
};

// Listar canjes de un usuario específico (vista de gestión/admin)
exports.listarPorUsuario = async (req, res) => {
    const { usuarioId } = req.params;
    const id = Number(usuarioId);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'usuarioId inválido' });
    }
    const canjes = await Canje.findAll({
        where: { usuario_id: id },
        include: [Usuario, Producto],
        order: [['fecha', 'DESC']]
    });
    res.json(canjes);
};

exports.actualizarEstado = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;
        const estadosPermitidos = ['pendiente', 'entregado', 'cancelado'];
        if (!estadosPermitidos.includes(estado)) {
            return res.status(400).json({ error: `Estado inválido. Permitidos: ${estadosPermitidos.join(', ')}. Para devolver use PUT /api/canjes/:id/devolver.` });
        }
        const canje = await Canje.findByPk(id);
        if (!canje) return res.status(404).json({ error: 'No encontrado' });
        await canje.update({ estado });
        res.json({ message: 'Estado actualizado', id: canje.id, estado: canje.estado });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Devolver un canje: marca 'devuelto', devuelve puntos y repone stock
exports.devolverCanje = async (req, res) => {
    const t = await Canje.sequelize.transaction();
    try {
        const { id } = req.params;
        const { motivo } = req.body;
        const adminNickname = req.user.nickname;

        if (!motivo || String(motivo).trim() === '') {
            await t.rollback();
            return res.status(400).json({ error: 'Motivo de devolución es requerido' });
        }

        const canje = await Canje.findByPk(id, { include: [Usuario, Producto], transaction: t, lock: t.LOCK.UPDATE });
        if (!canje) {
            await t.rollback();
            return res.status(404).json({ error: 'Canje no encontrado' });
        }

        if (canje.estado === 'devuelto') {
            await t.rollback();
            return res.status(400).json({ error: 'El canje ya está devuelto' });
        }

        if (!['pendiente', 'entregado'].includes(canje.estado)) {
            await t.rollback();
            return res.status(400).json({ error: 'Solo se pueden devolver canjes pendientes o entregados' });
        }

        const usuario = canje.Usuario;
        const producto = canje.Producto;
        const puntosADevolver = producto.precio;
        const puntosAnteriores = usuario.puntos;

        // 1. Marcar canje como devuelto
        await canje.update({ estado: 'devuelto' }, { transaction: t });

        // 2. Devolver puntos al usuario
        const puntosNuevos = puntosAnteriores + puntosADevolver;
        await usuario.update({ puntos: puntosNuevos }, { transaction: t });

        // 3. Registrar historial
        await HistorialPunto.create({
            usuario_id: usuario.id,
            puntos: puntosADevolver,  // Cantidad positiva porque se devuelven puntos
            cambio: puntosADevolver,  // Campo legacy para compatibilidad
            tipo: 'ganado',
            concepto: `Devolución de canje: ${producto.nombre} - ${motivo} (Admin: ${adminNickname})`,
            motivo: `Devolución de canje: ${producto.nombre} - ${motivo} (Admin: ${adminNickname})`  // Campo legacy para compatibilidad
        }, { transaction: t });

        // 4. Reponer stock del producto (si corresponde)
        const stockActual = Number.isFinite(producto.stock) ? producto.stock : 0;
        await producto.update({ stock: stockActual + 1 }, { transaction: t });

        await t.commit();

        res.json({
            message: 'Canje devuelto correctamente',
            canje: { id: canje.id, estado: 'devuelto' },
            usuario: { id: usuario.id, nickname: usuario.nickname, puntosAnteriores, puntosNuevos },
            producto: { id: producto.id, nombre: producto.nombre, stockNuevo: stockActual + 1 }
        });
    } catch (error) {
        await t.rollback();
        console.error('Error al devolver canje:', error);
        res.status(500).json({ error: 'Error interno del servidor', message: error.message });
    }
};
