'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('notificaciones', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'usuarios',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'ID del usuario destinatario'
      },
      titulo: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Título de la notificación'
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Descripción detallada de la notificación'
      },
      tipo: {
        type: Sequelize.ENUM(
          'sub_regalada',
          'puntos_ganados',
          'canje_creado',
          'canje_entregado',
          'canje_cancelado',
          'canje_devuelto',
          'historial_evento',
          'sistema'
        ),
        allowNull: false,
        defaultValue: 'sistema',
        comment: 'Tipo de notificación'
      },
      estado: {
        type: Sequelize.ENUM('no_leida', 'leida'),
        allowNull: false,
        defaultValue: 'no_leida',
        comment: 'Estado de lectura'
      },
      datos_relacionados: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Datos contextuales en JSON'
      },
      enlace_detalle: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Ruta relativa para navegar al detalle'
      },
      fecha_lectura: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha cuando se marcó como leída'
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha de eliminación (soft delete)'
      },
      fecha_creacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
        comment: 'Fecha de creación'
      },
      fecha_actualizacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
        onUpdate: Sequelize.fn('NOW'),
        comment: 'Última actualización'
      }
    });

    // Crear índices para mejorar performance
    await queryInterface.addIndex('notificaciones', ['usuario_id']);
    await queryInterface.addIndex('notificaciones', ['estado']);
    await queryInterface.addIndex('notificaciones', ['tipo']);
    await queryInterface.addIndex('notificaciones', ['usuario_id', 'estado']);
    await queryInterface.addIndex('notificaciones', ['fecha_creacion'], { order: 'DESC' });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('notificaciones');
  }
};

