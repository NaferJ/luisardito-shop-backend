const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const KickBroadcasterToken = sequelize.define('KickBroadcasterToken', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    kick_user_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'ID del broadcaster en Kick'
    },
    kick_username: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Username del broadcaster'
    },
    access_token: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Token de acceso de Kick (encriptado en producción)'
    },
    refresh_token: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Token de refresco (si está disponible)'
    },
    token_expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Cuándo expira el token'
    },
    scopes: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Scopes autorizados por el broadcaster'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Si la conexión está activa'
    },
    auto_subscribed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si se auto-suscribió a eventos exitosamente'
    },
    last_subscription_attempt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Última vez que se intentó suscribir'
    },
    subscription_error: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Error de la última suscripción (si hubo)'
    }
}, {
    tableName: 'kick_broadcaster_tokens',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['kick_user_id']
        },
        {
            fields: ['is_active']
        }
    ]
});

module.exports = KickBroadcasterToken;
