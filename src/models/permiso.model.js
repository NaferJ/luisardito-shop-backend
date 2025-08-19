const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const Permiso = sequelize.define('Permiso', {
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
    tableName: 'permisos',
    timestamps: false
});

module.exports = Permiso;
