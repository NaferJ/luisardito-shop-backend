const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const Promocion = sequelize.define('Promocion', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    codigo: {
        type: DataTypes.STRING(50),
        allowNull: true,
        unique: true,
        comment: 'Código opcional para cupones de descuento (ej: VERANO2024)'
    },
    nombre: {
        type: DataTypes.STRING(200),
        allowNull: false,
        comment: 'Nombre interno de la promoción'
    },
    titulo: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Título público mostrado al usuario'
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Descripción detallada de la promoción'
    },
    tipo: {
        type: DataTypes.ENUM('producto', 'categoria', 'global', 'por_cantidad'),
        defaultValue: 'producto',
        comment: 'Tipo de aplicación de la promoción'
    },
    tipo_descuento: {
        type: DataTypes.ENUM('porcentaje', 'fijo', '2x1', '3x2'),
        defaultValue: 'porcentaje',
        comment: 'Tipo de descuento aplicado'
    },
    valor_descuento: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Valor del descuento (porcentaje o puntos fijos)'
    },
    descuento_maximo: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Descuento máximo en puntos (para porcentajes)'
    },
    fecha_inicio: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Fecha y hora de inicio de la promoción'
    },
    fecha_fin: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Fecha y hora de fin de la promoción'
    },
    cantidad_usos_maximos: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Límite de usos totales (null = ilimitado)'
    },
    cantidad_usos_actuales: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Contador de usos actuales'
    },
    usos_por_usuario: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: 'Límite de usos por usuario'
    },
    minimo_puntos: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Puntos mínimos requeridos para aplicar la promoción'
    },
    requiere_codigo: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Si requiere código de cupón o es automático'
    },
    prioridad: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Prioridad para resolver conflictos (mayor = más prioridad)'
    },
    estado: {
        type: DataTypes.ENUM('activo', 'programado', 'expirado', 'inactivo', 'pausado'),
        defaultValue: 'programado',
        comment: 'Estado actual de la promoción'
    },
    aplica_acumulacion: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Si puede acumularse con otras promociones'
    },
    metadata_visual: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Configuración visual para el frontend (gradientes, badges, etc.)',
        defaultValue: {
            badge: {
                texto: 'OFERTA',
                posicion: 'top-right',
                animacion: 'pulse'
            },
            gradiente: ['#FF6B6B', '#FF8E53'],
            badge_color: '#FF0000',
            mostrar_countdown: true,
            mostrar_ahorro: true
        }
    },
    reglas_aplicacion: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Reglas de aplicación (productos, categorías, exclusiones)',
        defaultValue: {
            productos_ids: [],
            categorias_ids: [],
            excluir_productos_ids: [],
            minimo_cantidad: 1
        }
    },
    creado_por: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'ID del usuario admin que creó la promoción'
    }
}, {
    tableName: 'promociones',
    timestamps: true,
    createdAt: 'creado',
    updatedAt: 'actualizado',
    indexes: [
        {
            fields: ['codigo']
        },
        {
            fields: ['estado']
        },
        {
            fields: ['fecha_inicio', 'fecha_fin']
        },
        {
            fields: ['tipo']
        }
    ],
    hooks: {
        beforeSave: (promocion) => {
            // Validar que fecha_fin sea mayor que fecha_inicio
            if (promocion.fecha_fin <= promocion.fecha_inicio) {
                throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
            }
            
            // Validar descuento
            if (promocion.tipo_descuento === 'porcentaje' && promocion.valor_descuento > 100) {
                throw new Error('El descuento por porcentaje no puede ser mayor a 100%');
            }
            
            if (promocion.valor_descuento < 0) {
                throw new Error('El valor del descuento no puede ser negativo');
            }
            
            // Auto-actualizar estado basado en fechas
            const ahora = new Date();
            if (promocion.estado !== 'inactivo' && promocion.estado !== 'pausado') {
                if (ahora < promocion.fecha_inicio) {
                    promocion.estado = 'programado';
                } else if (ahora >= promocion.fecha_inicio && ahora <= promocion.fecha_fin) {
                    promocion.estado = 'activo';
                } else if (ahora > promocion.fecha_fin) {
                    promocion.estado = 'expirado';
                }
            }
        }
    }
});

// Métodos de instancia
Promocion.prototype.estaActiva = function() {
    const ahora = new Date();
    return this.estado === 'activo' && 
           ahora >= this.fecha_inicio && 
           ahora <= this.fecha_fin &&
           (this.cantidad_usos_maximos === null || this.cantidad_usos_actuales < this.cantidad_usos_maximos);
};

Promocion.prototype.calcularDescuento = function(precioOriginal) {
    let descuento = 0;
    
    switch (this.tipo_descuento) {
        case 'porcentaje':
            descuento = Math.floor((precioOriginal * this.valor_descuento) / 100);
            if (this.descuento_maximo && descuento > this.descuento_maximo) {
                descuento = this.descuento_maximo;
            }
            break;
        case 'fijo':
            descuento = this.valor_descuento;
            break;
        case '2x1':
        case '3x2':
            // Para estos tipos, el descuento se calcula en el carrito
            descuento = 0;
            break;
    }
    
    return Math.min(descuento, precioOriginal);
};

Promocion.prototype.puedeUsarUsuario = async function(usuarioId) {
    if (!usuarioId) return !this.requiere_codigo;
    
    const UsoPromocion = require('./usoPromocion.model');
    const usosUsuario = await UsoPromocion.count({
        where: {
            promocion_id: this.id,
            usuario_id: usuarioId
        }
    });
    
    return usosUsuario < this.usos_por_usuario;
};

module.exports = Promocion;
