const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const KickUserTracking = sequelize.define('KickUserTracking', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    kick_user_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'ID del usuario de Kick'
    },
    kick_username: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Username del usuario de Kick'
    },
    // Tracking de follows
    has_followed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si ya siguió al canal alguna vez'
    },
    first_follow_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Primera vez que siguió al canal'
    },
    follow_points_awarded: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si ya se le otorgaron puntos por follow'
    },
    // Tracking de suscripciones
    is_subscribed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si está actualmente suscrito'
    },
    subscription_expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Cuándo expira su suscripción actual'
    },
    subscription_duration_months: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Duración de la suscripción en meses'
    },
    total_subscriptions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Cantidad total de suscripciones (new + renewal)'
    },
    total_gifts_received: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Cantidad de subs regaladas recibidas'
    },
    total_gifts_given: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Cantidad de subs que ha regalado'
    },
    total_kicks_gifted: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Cantidad total de kicks regalados por el usuario'
    }
}, {
    tableName: 'kick_user_tracking',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['kick_user_id']
        },
        {
            fields: ['kick_username']
        },
        {
            fields: ['is_subscribed']
        }
    ]
});

module.exports = KickUserTracking;
