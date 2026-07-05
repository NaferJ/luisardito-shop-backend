"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Verificar si la tabla botrix_migration_config existe
      const [tables] = await queryInterface.sequelize.query(
        "SHOW TABLES LIKE 'botrix_migration_config'"
      );

      if (tables.length === 0) {
        console.log("❌ Tabla botrix_migration_config no existe, creándola...");

        // Crear la tabla con la estructura correcta
        await queryInterface.createTable("botrix_migration_config", {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
          },
          migration_enabled: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
          },
          vip_points_enabled: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
          },
          vip_chat_points: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 5,
          },
          vip_follow_points: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 100,
          },
          vip_sub_points: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 300,
          },
          created_at: {
            allowNull: false,
            type: Sequelize.DATE,
          },
          updated_at: {
            allowNull: false,
            type: Sequelize.DATE,
          },
        });

        // Insertar configuración por defecto
        await queryInterface.bulkInsert("botrix_migration_config", [
          {
            migration_enabled: true,
            vip_points_enabled: false,
            vip_chat_points: 5,
            vip_follow_points: 100,
            vip_sub_points: 300,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ]);

        console.log(
          "✅ Tabla botrix_migration_config creada con configuración por defecto"
        );
        return;
      }

      // Si la tabla existe, verificar su estructura actual
      const [columns] = await queryInterface.sequelize.query(
        "DESCRIBE botrix_migration_config"
      );

      const hasOldStructure = columns.some((col) => col.Field === "config_key");

      if (hasOldStructure) {
        console.log(
          "🔄 Detectada estructura antigua, migrando a nueva estructura..."
        );

        // Hacer backup de datos existentes si los hay
        const [existingData] = await queryInterface.sequelize.query(
          "SELECT * FROM botrix_migration_config"
        );

        // Recrear la tabla con la estructura correcta
        await queryInterface.dropTable("botrix_migration_config");

        await queryInterface.createTable("botrix_migration_config", {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
          },
          migration_enabled: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
          },
          vip_points_enabled: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
          },
          vip_chat_points: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 5,
          },
          vip_follow_points: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 100,
          },
          vip_sub_points: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 300,
          },
          created_at: {
            allowNull: false,
            type: Sequelize.DATE,
          },
          updated_at: {
            allowNull: false,
            type: Sequelize.DATE,
          },
        });

        // Insertar configuración por defecto
        await queryInterface.bulkInsert("botrix_migration_config", [
          {
            migration_enabled: true,
            vip_points_enabled: false,
            vip_chat_points: 5,
            vip_follow_points: 100,
            vip_sub_points: 300,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ]);

        console.log(
          "✅ Tabla botrix_migration_config migrada a nueva estructura"
        );
      } else {
        console.log(
          "✅ Tabla botrix_migration_config ya tiene la estructura correcta"
        );

        // Verificar si tiene datos, si no insertar configuración por defecto
        const [count] = await queryInterface.sequelize.query(
          "SELECT COUNT(*) as count FROM botrix_migration_config"
        );

        if (count[0].count === 0) {
          await queryInterface.bulkInsert("botrix_migration_config", [
            {
              migration_enabled: true,
              vip_points_enabled: false,
              vip_chat_points: 5,
              vip_follow_points: 100,
              vip_sub_points: 300,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ]);
          console.log("✅ Configuración por defecto insertada");
        }
      }
    } catch (error) {
      console.error("Error en migración de botrix_migration_config:", error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("botrix_migration_config");
    console.log("❌ Tabla botrix_migration_config eliminada");
  },
};
