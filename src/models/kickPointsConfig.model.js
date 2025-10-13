const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const KickPointsConfig = sequelize.define('KickPointsConfig', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    config_key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Clave de configuración única'
    },
    config_value: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Valor de puntos'
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Descripción de la configuración'
    },
    enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Si está habilitada esta configuración'
    }
}, {
    tableName: 'kick_points_config',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = KickPointsConfig;
