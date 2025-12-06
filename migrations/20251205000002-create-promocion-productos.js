'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('promocion_productos', {
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
      producto_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'productos',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      creado: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Crear índice único para evitar duplicados
    await queryInterface.addIndex('promocion_productos', ['promocion_id', 'producto_id'], {
      unique: true,
      name: 'idx_promocion_productos_unique'
    });

    // Índice para búsquedas por producto
    await queryInterface.addIndex('promocion_productos', ['producto_id'], {
      name: 'idx_promocion_productos_producto'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('promocion_productos');
  }
};
