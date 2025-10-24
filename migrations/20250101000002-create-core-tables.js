'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Crear tabla usuarios
    await queryInterface.createTable('usuarios', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id_ext: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true
      },
      nickname: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true
      },
      password_hash: {
        type: Sequelize.STRING,
        allowNull: false
      },
      puntos: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      kick_data: {
        type: Sequelize.JSON,
        allowNull: true
      },
      rol_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        references: {
          model: 'roles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      creado: {
        type: Sequelize.DATE,
        allowNull: false
      },
      actualizado: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Crear tabla productos
    await queryInterface.createTable('productos', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      nombre: {
        type: Sequelize.STRING,
        allowNull: false
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      precio: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      stock: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      estado: {
        type: Sequelize.ENUM('publicado', 'borrador', 'eliminado'),
        defaultValue: 'borrador'
      },
      imagen_url: {
        type: Sequelize.STRING,
        allowNull: true
      },
      creado: {
        type: Sequelize.DATE,
        allowNull: false
      },
      actualizado: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Crear tabla canjes
    await queryInterface.createTable('canjes', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'usuarios',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      producto_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'productos',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      estado: {
        type: Sequelize.ENUM('pendiente', 'entregado', 'cancelado', 'devuelto'),
        defaultValue: 'pendiente'
      },
      fecha: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Crear tabla historial_puntos
    await queryInterface.createTable('historial_puntos', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'usuarios',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      puntos: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Cantidad de puntos (positivo o negativo)'
      },
      cambio: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Campo legacy - se mantiene por compatibilidad'
      },
      tipo: {
        type: Sequelize.ENUM('ganado', 'gastado', 'ajuste'),
        allowNull: false,
        defaultValue: 'ganado',
        comment: 'Tipo de movimiento de puntos'
      },
      concepto: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Descripción del concepto'
      },
      motivo: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Campo legacy - se mantiene por compatibilidad'
      },
      kick_event_data: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Datos del evento de Kick asociado'
      },
      fecha: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('historial_puntos');
    await queryInterface.dropTable('canjes');
    await queryInterface.dropTable('productos');
    await queryInterface.dropTable('usuarios');
  }
};
