
const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const KickEventSubscription = sequelize.define('KickEventSubscription', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    subscription_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'ID de la suscripción en Kick (ULID)'
    },
    app_id: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'ID de la aplicación en Kick'
    },
    broadcaster_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'ID del broadcaster (usuario de Kick)'
    },
    event_type: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Tipo de evento (ej: chat.message.sent, channel.followed)'
    },
    event_version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Versión del evento'
    },
    method: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'webhook',
        comment: 'Método de entrega (webhook)'
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'error'),
        allowNull: false,
        defaultValue: 'active',
        comment: 'Estado de la suscripción'
    }
}, {
    tableName: 'kick_event_subscriptions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['broadcaster_user_id']
        },
        {
            fields: ['event_type']
        },
        {
            fields: ['status']
        }
    ]
});

module.exports = KickEventSubscription;
