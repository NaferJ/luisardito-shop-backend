'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('uso_promociones', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      promocion_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'promociones',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'usuarios',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      canje_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'canjes',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      producto_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'productos',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      codigo_usado: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      precio_original: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      descuento_aplicado: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      precio_final: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true
      },
      fecha_uso: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Crear índices para búsquedas eficientes
    await queryInterface.addIndex('uso_promociones', ['promocion_id'], {
      name: 'idx_uso_promociones_promocion'
    });

    await queryInterface.addIndex('uso_promociones', ['usuario_id'], {
      name: 'idx_uso_promociones_usuario'
    });

    await queryInterface.addIndex('uso_promociones', ['canje_id'], {
      name: 'idx_uso_promociones_canje'
    });

    await queryInterface.addIndex('uso_promociones', ['fecha_uso'], {
      name: 'idx_uso_promociones_fecha'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('uso_promociones');
  }
};
