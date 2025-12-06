const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const UsoPromocion = sequelize.define('UsoPromocion', {
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
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuarios',
            key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    },
    canje_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'canjes',
            key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        comment: 'Referencia al canje donde se aplicó el descuento'
    },
    producto_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'productos',
            key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        comment: 'Producto al que se aplicó el descuento'
    },
    codigo_usado: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Código de cupón usado (si aplica)'
    },
    precio_original: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Precio original en puntos antes del descuento'
    },
    descuento_aplicado: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Cantidad de puntos descontados'
    },
    precio_final: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Precio final en puntos después del descuento'
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Información adicional sobre el uso',
        defaultValue: {}
    }
}, {
    tableName: 'uso_promociones',
    timestamps: true,
    createdAt: 'fecha_uso',
    updatedAt: false,
    indexes: [
        {
            fields: ['promocion_id']
        },
        {
            fields: ['usuario_id']
        },
        {
            fields: ['canje_id']
        },
        {
            fields: ['fecha_uso']
        }
    ]
});

module.exports = UsoPromocion;
