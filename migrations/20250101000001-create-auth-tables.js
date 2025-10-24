'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Crear tabla roles
    await queryInterface.createTable('roles', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      nombre: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      descripcion: {
        type: Sequelize.STRING,
        allowNull: true
      }
    });

    // Crear tabla permisos
    await queryInterface.createTable('permisos', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      nombre: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      descripcion: {
        type: Sequelize.STRING,
        allowNull: true
      }
    });

    // Crear tabla rol_permisos
    await queryInterface.createTable('rol_permisos', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      rol_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'roles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      permiso_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'permisos',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      }
    });

    // Crear índice único para rol_permisos
    await queryInterface.addIndex('rol_permisos', ['rol_id', 'permiso_id'], {
      unique: true,
      name: 'rol_perm_unique'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('rol_permisos');
    await queryInterface.dropTable('permisos');
    await queryInterface.dropTable('roles');
  }
};
