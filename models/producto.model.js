const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const Producto = sequelize.define('Producto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING,
        allowNull: false
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    precio: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    stock: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    estado: {
        type: DataTypes.ENUM('publicado', 'borrador', 'eliminado'),
        defaultValue: 'borrador'
    },
    imagen_url: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'productos',
    timestamps: true,
    createdAt: 'creado',
    updatedAt: 'actualizado'
});

module.exports = Producto;
