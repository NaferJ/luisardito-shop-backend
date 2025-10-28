const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const BotrixMigrationConfig = sequelize.define('BotrixMigrationConfig', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    migration_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    vip_points_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    vip_chat_points: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5
    },
    vip_follow_points: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100
    },
    vip_sub_points: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 300
    }
}, {
    tableName: 'botrix_migration_config',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Método estático para obtener la configuración actual
BotrixMigrationConfig.getConfig = async function() {
    let config = await this.findOne();
    if (!config) {
        // Crear configuración por defecto si no existe
        config = await this.create({
            migration_enabled: true,
            vip_points_enabled: false,
            vip_chat_points: 5,
            vip_follow_points: 100,
            vip_sub_points: 300
        });
    }
    return config;
};

module.exports = BotrixMigrationConfig;
