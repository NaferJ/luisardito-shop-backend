const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const KickWebhookEvent = sequelize.define('KickWebhookEvent', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    message_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'ID único del mensaje (ULID) - clave de idempotencia'
    },
    subscription_id: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'ID de la suscripción asociada al evento'
    },
    event_type: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Tipo de evento (ej: chat.message.sent)'
    },
    event_version: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Versión del evento'
    },
    message_timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Timestamp de cuándo se envió el mensaje'
    },
    payload: {
        type: DataTypes.JSON,
        allowNull: false,
        comment: 'Contenido del evento'
    },
    processed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Indica si el evento ha sido procesado'
    },
    processed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp de cuándo se procesó el evento'
    }
}, {
    tableName: 'kick_webhook_events',
    timestamps: true,
    createdAt: 'received_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['message_id']
        },
        {
            fields: ['event_type']
        },
        {
            fields: ['processed']
        },
        {
            fields: ['message_timestamp']
        }
    ]
});

module.exports = KickWebhookEvent;
