const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const BotrixMigrationConfig = sequelize.define('BotrixMigrationConfig', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    config_key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    config_value: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'botrix_migration_config',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Métodos estáticos para facilitar el acceso a configuraciones
BotrixMigrationConfig.getConfig = async function() {
    const configs = await this.findAll();
    const configMap = {};

    configs.forEach(config => {
        const key = config.config_key;
        let value = config.config_value;

        // Convertir valores según el tipo
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (!isNaN(value) && value !== '') value = Number(value);

        configMap[key] = value;
    });

    // Valores por defecto si no existen
    const defaults = {
        migration_enabled: true,
        vip_points_enabled: false,
        vip_chat_points: 5,
        vip_follow_points: 100,
        vip_sub_points: 300
    };

    return { ...defaults, ...configMap };
};

BotrixMigrationConfig.setConfig = async function(key, value) {
    const stringValue = typeof value === 'boolean' ? value.toString() : value.toString();

    const [config, created] = await this.findOrCreate({
        where: { config_key: key },
        defaults: {
            config_key: key,
            config_value: stringValue
        }
    });

    if (!created) {
        await config.update({ config_value: stringValue });
    }

    return config;
};

module.exports = BotrixMigrationConfig;
