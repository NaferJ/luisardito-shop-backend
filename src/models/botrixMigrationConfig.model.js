const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');
const logger = require('../utils/logger');

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
        comment: 'Enables/disables watchtime migration from Botrix'
    }
}, {
    tableName: 'botrix_migration_config',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Simplified static methods to work with the current structure
BotrixMigrationConfig.getConfig = async function() {
    try {
        const config = await this.findByPk(1);

        if (!config) {
            // Create default config if it does not exist
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
        logger.error('Error getting config:', error);
        // Return default values on error
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
            // Create config if it does not exist
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
            // Update existing config
            await config.update({ [key]: value });
        }

        return config;
    } catch (error) {
        logger.error('Error updating config:', error);
        throw error;
    }
};

module.exports = BotrixMigrationConfig;
