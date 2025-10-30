const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const KickBotToken = sequelize.define('KickBotToken', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    kick_user_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    kick_username: {
        type: DataTypes.STRING,
        allowNull: false
    },
    access_token: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    refresh_token: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    token_expires_at: {
        type: DataTypes.DATE,
        allowNull: false
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    scopes: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Scopes autorizados para el bot'
    }
}, {
    tableName: 'kick_bot_tokens',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = KickBotToken;