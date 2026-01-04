const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');
const Usuario = require('./usuario.model');

const UserWatchtime = sequelize.define('UserWatchtime', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Usuario,
            key: 'id'
        },
        comment: 'ID del usuario'
    },
    kick_user_id: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'ID de usuario en Kick (para auditoría)'
    },
    total_watchtime_minutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total de minutos de watchtime acumulados'
    },
    message_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total de mensajes registrados'
    },
    first_message_date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha del primer mensaje registrado'
    },
    last_message_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha del último mensaje registrado'
    }
}, {
    tableName: 'user_watchtime',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Relaciones
UserWatchtime.belongsTo(Usuario, { foreignKey: 'usuario_id' });
Usuario.hasOne(UserWatchtime, { foreignKey: 'usuario_id' });

module.exports = UserWatchtime;

