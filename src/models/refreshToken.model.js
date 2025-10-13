const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const RefreshToken = sequelize.define('RefreshToken', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'ID del usuario en nuestra BD'
    },
    token: {
        type: DataTypes.STRING(500),
        allowNull: false,
        unique: true,
        comment: 'Refresh token (UUID o JWT)'
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Fecha de expiración del refresh token'
    },
    is_revoked: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si el token fue revocado (logout)'
    },
    revoked_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Cuándo se revocó el token'
    },
    ip_address: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'IP desde donde se creó'
    },
    user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'User agent del navegador'
    },
    replaced_by_token: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Token que reemplazó a este (para rotación)'
    }
}, {
    tableName: 'refresh_tokens',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['token']
        },
        {
            fields: ['usuario_id']
        },
        {
            fields: ['expires_at']
        },
        {
            fields: ['is_revoked']
        }
    ]
});

module.exports = RefreshToken;
