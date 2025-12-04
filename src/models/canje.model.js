const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const Canje = sequelize.define('Canje', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    producto_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    precio_al_canje: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Precio en puntos al momento del canje'
    },
    estado: {
        type: DataTypes.ENUM('pendiente', 'entregado', 'cancelado', 'devuelto'),
        defaultValue: 'pendiente'
    }
}, {
    tableName: 'canjes',
    timestamps: true,
    createdAt: 'fecha',
    updatedAt: false
});

module.exports = Canje;
