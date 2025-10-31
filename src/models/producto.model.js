const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Función para generar slug
function generateSlug(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
        .trim()
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

const Producto = sequelize.define('Producto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING,
        allowNull: false
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    precio: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    stock: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    estado: {
        type: DataTypes.ENUM('publicado', 'borrador', 'eliminado'),
        defaultValue: 'borrador'
    },
    imagen_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    slug: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    }
}, {
    tableName: 'productos',
    timestamps: true,
    createdAt: 'creado',
    updatedAt: 'actualizado',
    hooks: {
        beforeCreate: (producto) => {
            if (producto.nombre && !producto.slug) {
                producto.slug = generateSlug(producto.nombre);
            }
        },
        beforeUpdate: (producto) => {
            if (producto.nombre && producto.changed('nombre')) {
                producto.slug = generateSlug(producto.nombre);
            }
        }
    }
});

module.exports = Producto;
