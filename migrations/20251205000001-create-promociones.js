'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('promociones', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      codigo: {
        type: Sequelize.STRING(50),
        allowNull: true,
        unique: true
      },
      nombre: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      titulo: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      tipo: {
        type: Sequelize.ENUM('producto', 'categoria', 'global', 'por_cantidad'),
        defaultValue: 'producto'
      },
      tipo_descuento: {
        type: Sequelize.ENUM('porcentaje', 'fijo', '2x1', '3x2'),
        defaultValue: 'porcentaje'
      },
      valor_descuento: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      descuento_maximo: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      fecha_inicio: {
        type: Sequelize.DATE,
        allowNull: false
      },
      fecha_fin: {
        type: Sequelize.DATE,
        allowNull: false
      },
      cantidad_usos_maximos: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      cantidad_usos_actuales: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      usos_por_usuario: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      minimo_puntos: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      requiere_codigo: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      prioridad: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      estado: {
        type: Sequelize.ENUM('activo', 'programado', 'expirado', 'inactivo', 'pausado'),
        defaultValue: 'programado'
      },
      aplica_acumulacion: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      metadata_visual: {
        type: Sequelize.JSON,
        allowNull: true
      },
      reglas_aplicacion: {
        type: Sequelize.JSON,
        allowNull: true
      },
      creado_por: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      creado: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      actualizado: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Crear índices
    await queryInterface.addIndex('promociones', ['codigo'], {
      name: 'idx_promociones_codigo'
    });

    await queryInterface.addIndex('promociones', ['estado'], {
      name: 'idx_promociones_estado'
    });

    await queryInterface.addIndex('promociones', ['fecha_inicio', 'fecha_fin'], {
      name: 'idx_promociones_fechas'
    });

    await queryInterface.addIndex('promociones', ['tipo'], {
      name: 'idx_promociones_tipo'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('promociones');
  }
};
