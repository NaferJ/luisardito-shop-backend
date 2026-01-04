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
        allowNull: true
    },
    puntos: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    max_puntos: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Máximo de puntos que ha alcanzado el usuario en su historial'
    },
    kick_data: {
        type: DataTypes.JSON,
        allowNull: true
    },
    discord_username: {
        type: DataTypes.STRING,
        allowNull: true
    },
    botrix_migrated: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    botrix_migrated_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    botrix_points_migrated: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    botrix_watchtime_migrated: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Indica si el usuario ya migró su watchtime desde Botrix'
    },
    botrix_watchtime_migrated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha en que se realizó la migración de watchtime'
    },
    botrix_watchtime_minutes_migrated: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Minutos totales de watchtime migrados desde Botrix'
    },
    is_vip: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    vip_granted_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    vip_expires_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    vip_granted_by_canje_id: {
        type: DataTypes.INTEGER,
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

// Métodos de instancia
Usuario.prototype.isVipActive = function() {
    if (!this.is_vip) return false;
    if (!this.vip_expires_at) return true; // VIP permanente
    return new Date() < new Date(this.vip_expires_at);
};

Usuario.prototype.canMigrateBotrix = function() {
    return !this.botrix_migrated;
};

Usuario.prototype.canMigrateWatchtime = function() {
    return !this.botrix_watchtime_migrated;
};

Usuario.prototype.getUserType = function() {
    if (this.isVipActive()) return 'vip';
    if (this.kick_data?.is_subscriber) return 'subscriber';
    return 'regular';
};

// Relaciones
Usuario.belongsTo(Rol, { foreignKey: 'rol_id' });

module.exports = Usuario;
