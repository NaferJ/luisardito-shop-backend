'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Verificar si la columna puntos ya existe en la tabla usuarios
      const tableInfo = await queryInterface.describeTable('usuarios');

      if (!tableInfo.puntos) {
        console.log('📦 Agregando columna puntos a tabla usuarios...');
        await queryInterface.addColumn('usuarios', 'puntos', {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          allowNull: false
        });
        console.log('✅ Columna puntos agregada exitosamente');
      } else {
        console.log('ℹ️ La columna puntos ya existe en la tabla usuarios');
      }

      // Verificar también que la tabla historial_puntos existe
      const tables = await queryInterface.showAllTables();

      if (!tables.includes('historial_puntos')) {
        console.log('📦 Creando tabla historial_puntos...');
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
            allowNull: false,
            defaultValue: Sequelize.NOW
          }
        });
        console.log('✅ Tabla historial_puntos creada exitosamente');
      } else {
        console.log('ℹ️ La tabla historial_puntos ya existe');

        // Verificar si la columna puntos existe en historial_puntos
        const historialTableInfo = await queryInterface.describeTable('historial_puntos');
        if (!historialTableInfo.puntos) {
          console.log('📦 Agregando columna puntos a tabla historial_puntos...');
          await queryInterface.addColumn('historial_puntos', 'puntos', {
            type: Sequelize.INTEGER,
            allowNull: false,
            comment: 'Cantidad de puntos (positivo o negativo)'
          });
          console.log('✅ Columna puntos agregada a historial_puntos');
        }
      }

    } catch (error) {
      console.error('❌ Error en migración de emergencia:', error.message);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // En el rollback, removemos la columna si fue agregada por esta migración
      const tableInfo = await queryInterface.describeTable('usuarios');

      if (tableInfo.puntos) {
        await queryInterface.removeColumn('usuarios', 'puntos');
        console.log('✅ Columna puntos removida de usuarios');
      }

    } catch (error) {
      console.error('❌ Error en rollback de migración de emergencia:', error.message);
      throw error;
    }
  }
};
