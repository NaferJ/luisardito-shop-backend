const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const PromocionProducto = sequelize.define('PromocionProducto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    promocion_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'promociones',
            key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    },
    producto_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'productos',
            key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    }
}, {
    tableName: 'promocion_productos',
    timestamps: true,
    createdAt: 'creado',
    updatedAt: false,
    indexes: [
        {
            unique: true,
            fields: ['promocion_id', 'producto_id']
        },
        {
            fields: ['producto_id']
        }
    ]
});

module.exports = PromocionProducto;
