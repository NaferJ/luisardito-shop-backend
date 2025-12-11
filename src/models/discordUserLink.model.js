const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const DiscordUserLink = sequelize.define('DiscordUserLink', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    discord_user_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'ID único del usuario en Discord'
    },
    discord_username: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Username de Discord (puede cambiar)'
    },
    discord_discriminator: {
        type: DataTypes.STRING(10),
        allowNull: true,
        comment: 'Discriminator de Discord (ej: #1234)'
    },
    discord_avatar: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Hash del avatar de Discord'
    },
    tienda_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuarios',
            key: 'id'
        },
        comment: 'ID del usuario en la tienda'
    },
    kick_user_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'ID del usuario en Kick (si está vinculado)'
    },
    access_token: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Access token de Discord'
    },
    refresh_token: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Refresh token de Discord'
    },
    token_expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de expiración del access token'
    },
    linked_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Fecha de vinculación'
    }
}, {
    tableName: 'discord_user_links',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            unique: true,
            fields: ['discord_user_id']
        },
        {
            fields: ['tienda_user_id']
        },
        {
            fields: ['kick_user_id']
        }
    ]
});

// Relaciones
DiscordUserLink.associate = (models) => {
    DiscordUserLink.belongsTo(models.Usuario, {
        foreignKey: 'tienda_user_id',
        as: 'usuario'
    });
};

module.exports = DiscordUserLink;