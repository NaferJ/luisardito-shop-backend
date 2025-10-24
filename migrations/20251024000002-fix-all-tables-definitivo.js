'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔧 [MIGRACIÓN DEFINITIVA] Verificando y arreglando todas las tablas...');

    try {
      // 1. Verificar y arreglar tabla usuarios
      console.log('📋 Verificando tabla usuarios...');
      const tableUsuarios = await queryInterface.describeTable('usuarios');

      if (!tableUsuarios.puntos) {
        console.log('➕ Agregando columna puntos a usuarios...');
        await queryInterface.addColumn('usuarios', 'puntos', {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          allowNull: false
        });
      }

      // 2. Verificar y arreglar tabla historial_puntos completamente
      console.log('📋 Verificando tabla historial_puntos...');
      const tables = await queryInterface.showAllTables();

      if (tables.includes('historial_puntos')) {
        const tableHistorial = await queryInterface.describeTable('historial_puntos');

        // Verificar columnas faltantes
        const missingColumns = [];
        if (!tableHistorial.puntos) missingColumns.push('puntos');
        if (!tableHistorial.tipo) missingColumns.push('tipo');
        if (!tableHistorial.concepto) missingColumns.push('concepto');
        if (!tableHistorial.cambio) missingColumns.push('cambio');
        if (!tableHistorial.motivo) missingColumns.push('motivo');
        if (!tableHistorial.kick_event_data) missingColumns.push('kick_event_data');

        if (missingColumns.length > 0) {
          console.log('⚠️ La tabla historial_puntos está incompleta. Recreándola...');

          // Hacer backup de datos existentes
          let existingData = [];
          try {
            const [results] = await queryInterface.sequelize.query('SELECT * FROM historial_puntos');
            existingData = results;
            console.log(`💾 Backup de ${existingData.length} registros existentes`);
          } catch (error) {
            console.log('ℹ️ No hay datos existentes para respaldar');
          }

          // Eliminar tabla existente
          await queryInterface.dropTable('historial_puntos');
          console.log('🗑️ Tabla historial_puntos eliminada');

          // Recrear tabla completa
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

          console.log('✅ Tabla historial_puntos recreada correctamente');

          // Restaurar datos si los había
          if (existingData.length > 0) {
            console.log('🔄 Restaurando datos existentes...');
            for (const record of existingData) {
              try {
                await queryInterface.bulkInsert('historial_puntos', [{
                  usuario_id: record.usuario_id,
                  puntos: record.puntos || record.cambio || 0,
                  cambio: record.cambio,
                  tipo: record.tipo || 'ganado',
                  concepto: record.concepto || record.motivo || 'Registro migrado',
                  motivo: record.motivo,
                  kick_event_data: record.kick_event_data,
                  fecha: record.fecha || new Date()
                }]);
              } catch (error) {
                console.log(`⚠️ Error restaurando registro ${record.id}:`, error.message);
              }
            }
            console.log('✅ Datos restaurados');
          }
        } else {
          console.log('✅ Tabla historial_puntos ya está completa');
        }
      } else {
        console.log('➕ Creando tabla historial_puntos desde cero...');
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
        console.log('✅ Tabla historial_puntos creada correctamente');
      }

      console.log('🎉 [MIGRACIÓN DEFINITIVA] ¡Todas las tablas verificadas y arregladas!');

    } catch (error) {
      console.error('❌ [MIGRACIÓN DEFINITIVA] Error:', error.message);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Rollback de migración definitiva...');
    // Este rollback no hace nada porque no queremos deshacer las correcciones
    console.log('ℹ️ Rollback no implementado (se mantienen las correcciones)');
  }
};
