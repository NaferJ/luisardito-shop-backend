const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');
const Rol = require('./rol.model');
const Permiso = require('./permiso.model');

const RolPermiso = sequelize.define('RolPermiso', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    rol_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: Rol, key: 'id' }
    },
    permiso_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: Permiso, key: 'id' }
    }
}, {
    tableName: 'rol_permisos',
    timestamps: false,
    uniqueKeys: {
        rol_perm_unique: {
            fields: ['rol_id', 'permiso_id']
        }
    }
});

// Relaciones
Rol.belongsToMany(Permiso, {
    through: RolPermiso,
    foreignKey: 'rol_id',
    otherKey: 'permiso_id'
});
Permiso.belongsToMany(Rol, {
    through: RolPermiso,
    foreignKey: 'permiso_id',
    otherKey: 'rol_id'
});

module.exports = RolPermiso;
