const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');
const Rol = require('./rol.model');

const Usuario = sequelize.define('Usuario', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id_ext: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    nickname: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    password_hash: {
        type: DataTypes.STRING,
        allowNull: false
    },
    puntos: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    kick_data: {
        type: DataTypes.JSON,
        allowNull: true
    },
    rol_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        references: {
            model: Rol,
            key: 'id'
        }
    }
}, {
    tableName: 'usuarios',
    timestamps: true,
    createdAt: 'creado',
    updatedAt: 'actualizado'
});

// Relaciones
Usuario.belongsTo(Rol, { foreignKey: 'rol_id' });

module.exports = Usuario;
