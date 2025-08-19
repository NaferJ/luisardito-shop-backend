const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');
const Usuario = require('./usuario.model');
const Producto = require('./producto.model');

const Canje = sequelize.define('Canje', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: Usuario, key: 'id' }
    },
    producto_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: Producto, key: 'id' }
    },
    estado: {
        type: DataTypes.ENUM('pendiente', 'entregado', 'cancelado'),
        defaultValue: 'pendiente'
    }
}, {
    tableName: 'canjes',
    timestamps: true,
    createdAt: 'fecha',
    updatedAt: false
});

// Relaciones
Usuario.hasMany(Canje, { foreignKey: 'usuario_id' });
Canje.belongsTo(Usuario, { foreignKey: 'usuario_id' });
Producto.hasMany(Canje, { foreignKey: 'producto_id' });
Canje.belongsTo(Producto, { foreignKey: 'producto_id' });

module.exports = Canje;
