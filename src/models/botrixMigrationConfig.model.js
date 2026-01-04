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
    },
    watchtime_migration_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Habilita/deshabilita la migración de watchtime desde Botrix'
    }
}, {
    tableName: 'botrix_migration_config',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Métodos estáticos simplificados para funcionar con la estructura actual
BotrixMigrationConfig.getConfig = async function() {
    try {
        const config = await this.findByPk(1);

        if (!config) {
            // Crear configuración por defecto si no existe
            const defaultConfig = await this.create({
                migration_enabled: true,
                vip_points_enabled: false,
                vip_chat_points: 5,
                vip_follow_points: 100,
                vip_sub_points: 300,
                watchtime_migration_enabled: true
            });
            return defaultConfig.toJSON();
        }

        return config.toJSON();
    } catch (error) {
        console.error('Error obteniendo configuración:', error);
        // Retornar valores por defecto en caso de error
        return {
            migration_enabled: true,
            vip_points_enabled: false,
            vip_chat_points: 5,
            vip_follow_points: 100,
            vip_sub_points: 300,
            watchtime_migration_enabled: true
        };
    }
};

BotrixMigrationConfig.setConfig = async function(key, value) {
    try {
        let config = await this.findByPk(1);

        if (!config) {
            // Crear configuración si no existe
            const updateData = {
                migration_enabled: true,
                vip_points_enabled: false,
                vip_chat_points: 5,
                vip_follow_points: 100,
                vip_sub_points: 300,
                watchtime_migration_enabled: true
            };
            updateData[key] = value;
            config = await this.create(updateData);
        } else {
            // Actualizar configuración existente
            await config.update({ [key]: value });
        }

        return config;
    } catch (error) {
        console.error('Error actualizando configuración:', error);
        throw error;
    }
};

module.exports = BotrixMigrationConfig;
