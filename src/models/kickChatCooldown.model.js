const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const KickChatCooldown = sequelize.define('KickChatCooldown', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    kick_user_id: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'ID del usuario de Kick'
    },
    kick_username: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Username del usuario de Kick'
    },
    last_message_at: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Última vez que escribió y recibió puntos'
    },
    cooldown_expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Cuándo expira el cooldown (5 min después)'
    }
}, {
    tableName: 'kick_chat_cooldowns',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['kick_user_id']
        },
        {
            fields: ['cooldown_expires_at']
        }
    ]
});

module.exports = KickChatCooldown;
