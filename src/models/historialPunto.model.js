const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const HistorialPunto = sequelize.define('HistorialPunto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    cambio: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    motivo: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'historial_puntos',
    timestamps: true,
    createdAt: 'fecha',
    updatedAt: false
});

module.exports = HistorialPunto;
