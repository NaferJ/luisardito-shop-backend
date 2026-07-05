#!/usr/bin/env node

/**
 * Script para aplicar los cambios necesarios en la base de datos para el cooldown definitivo
 */

const { sequelize } = require("./src/models");

async function setupDatabaseForCooldown() {
  try {
    console.log("🔧 Configurando base de datos para cooldown definitivo...\n");

    // 1. Verificar si existe el índice UNIQUE en kick_user_id
    console.log("1️⃣ Verificando índice UNIQUE en kick_user_id...");

    const [indexes] = await sequelize.query(`
            SHOW INDEX FROM kick_chat_cooldowns WHERE Column_name = 'kick_user_id'
        `);

    const hasUniqueIndex = indexes.some(
      (index) =>
        index.Column_name === "kick_user_id" &&
        (index.Key_name === "PRIMARY" || index.Non_unique === 0)
    );

    if (hasUniqueIndex) {
      console.log("✅ Índice UNIQUE ya existe en kick_user_id");
    } else {
      console.log("⚠️ Índice UNIQUE no existe, creando...");

      // Verificar si hay duplicados antes de crear el índice UNIQUE
      const [duplicates] = await sequelize.query(`
                SELECT kick_user_id, COUNT(*) as count 
                FROM kick_chat_cooldowns 
                GROUP BY kick_user_id 
                HAVING COUNT(*) > 1
            `);

      if (duplicates.length > 0) {
        console.log("⚠️ Encontrados registros duplicados, limpiando...");

        for (const duplicate of duplicates) {
          console.log(
            `   Limpiando duplicados para usuario: ${duplicate.kick_user_id}`
          );

          // Mantener solo el más reciente
          await sequelize.query(
            `
                        DELETE FROM kick_chat_cooldowns 
                        WHERE kick_user_id = :kick_user_id 
                        AND id NOT IN (
                            SELECT id FROM (
                                SELECT id FROM kick_chat_cooldowns 
                                WHERE kick_user_id = :kick_user_id 
                                ORDER BY created_at DESC 
                                LIMIT 1
                            ) as temp
                        )
                    `,
            {
              replacements: { kick_user_id: duplicate.kick_user_id },
            }
          );
        }

        console.log("✅ Duplicados eliminados");
      }

      // Crear el índice UNIQUE
      await sequelize.query(`
                ALTER TABLE kick_chat_cooldowns 
                ADD UNIQUE INDEX idx_kick_user_id_unique (kick_user_id)
            `);

      console.log("✅ Índice UNIQUE creado en kick_user_id");
    }

    // 2. Verificar la estructura de la tabla
    console.log("\n2️⃣ Verificando estructura de la tabla...");

    const [columns] = await sequelize.query(`
            DESCRIBE kick_chat_cooldowns
        `);

    console.log("📋 Columnas de la tabla:");
    columns.forEach((col) => {
      console.log(
        `   - ${col.Field}: ${col.Type} ${col.Null === "NO" ? "NOT NULL" : "NULL"} ${col.Key || ""}`
      );
    });

    // 3. Verificar configuración de transacciones
    console.log("\n3️⃣ Verificando configuración de transacciones...");

    const [isolationLevel] = await sequelize.query(`
            SELECT @@transaction_isolation as isolation_level
        `);

    console.log(
      `📊 Nivel de aislamiento actual: ${isolationLevel[0].isolation_level}`
    );

    // 4. Verificar locks
    console.log("\n4️⃣ Verificando soporte para locks...");

    const [lockSupport] = await sequelize.query(`
            SELECT @@innodb_lock_wait_timeout as lock_timeout
        `);

    console.log(`🔒 Timeout de lock: ${lockSupport[0].lock_timeout} segundos`);

    // 5. Limpiar cooldowns muy antiguos (opcional)
    console.log("\n5️⃣ Limpiando cooldowns antiguos...");

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [result] = await sequelize.query(
      `
            DELETE FROM kick_chat_cooldowns 
            WHERE cooldown_expires_at < :one_hour_ago
        `,
      {
        replacements: { one_hour_ago: oneHourAgo },
      }
    );

    console.log(`🧹 Eliminados ${result.affectedRows || 0} cooldowns antiguos`);

    // 6. Estadísticas finales
    console.log("\n6️⃣ Estadísticas de la tabla...");

    const [stats] = await sequelize.query(`
            SELECT 
                COUNT(*) as total_cooldowns,
                COUNT(DISTINCT kick_user_id) as unique_users,
                MAX(cooldown_expires_at) as latest_expiry
            FROM kick_chat_cooldowns
        `);

    console.log("📊 Estadísticas actuales:");
    console.log(`   - Total cooldowns: ${stats[0].total_cooldowns}`);
    console.log(`   - Usuarios únicos: ${stats[0].unique_users}`);
    console.log(`   - Última expiración: ${stats[0].latest_expiry || "N/A"}`);

    console.log(
      "\n✅ Base de datos configurada correctamente para cooldown definitivo"
    );
    console.log("🎯 El sistema SELECT FOR UPDATE está listo para usar");
  } catch (error) {
    console.error("❌ Error configurando base de datos:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }

  process.exit(0);
}

if (require.main === module) {
  setupDatabaseForCooldown();
}

module.exports = { setupDatabaseForCooldown };
