const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const Rol = sequelize.define('Rol', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    descripcion: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'roles',
    timestamps: false
});

module.exports = Rol;
