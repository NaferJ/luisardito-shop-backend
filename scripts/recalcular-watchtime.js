#!/usr/bin/env node

/**
 * Script de reconciliación de watchtime para usuarios migrados desde Botrix.
 *
 * Problema: el bot sumaba 5 min por mensaje, lo que inflaba el watchtime.
 * Solución: recalcular el watchtime generado por el bot usando como techo
 * el tiempo real entre el primer y último mensaje del usuario.
 *
 * Uso:
 *   node scripts/recalcular-watchtime.js --dry-run   # Solo muestra cambios
 *   node scripts/recalcular-watchtime.js             # Aplica cambios
 */

require("../config");
const { Usuario, UserWatchtime, sequelize } = require("../src/models");

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`[RECALCULAR WATCHTIME] Modo: ${DRY_RUN ? "DRY-RUN" : "REAL"}`);
  console.log("");

  const usuarios = await Usuario.findAll({
    where: { botrix_watchtime_migrated: true },
    include: [{ model: UserWatchtime, as: "watchtime", required: false }],
  });

  console.log(`Usuarios migrados encontrados: ${usuarios.length}`);
  console.log("");

  let cambios = 0;
  let sinCambios = 0;
  let errores = 0;

  for (const usuario of usuarios) {
    const wt = usuario.watchtime;
    const nombre = usuario.nickname || `ID:${usuario.id}`;

    if (!wt) {
      console.log(`  ⚠️  ${nombre}: sin registro de watchtime`);
      errores++;
      continue;
    }

    const botrixOriginal = usuario.botrix_watchtime_minutes_migrated || 0;
    const currentTotal = wt.total_watchtime_minutes;
    const firstMsg = wt.first_message_date;
    const lastMsg = wt.last_message_at;

    if (!firstMsg || !lastMsg) {
      console.log(`  ⚠️  ${nombre}: fechas de mensaje incompletas`);
      errores++;
      continue;
    }

    // Todo lo que NO es botrix fue generado por mi bot (pre + post migración)
    const botGeneratedTotal = currentTotal - botrixOriginal;

    if (botGeneratedTotal <= 0) {
      console.log(
        `  ℹ️  ${nombre}: ${currentTotal} min (todo es Botrix), sin cambios`
      );
      sinCambios++;
      continue;
    }

    // Ventana real entre primer y último mensaje (en minutos)
    const totalWindowMinutes = Math.floor(
      (new Date(lastMsg) - new Date(firstMsg)) / 60000
    );

    if (totalWindowMinutes <= 0) {
      console.log(
        `  ⚠️  ${nombre}: ventana de tiempo inválida (${totalWindowMinutes} min)`
      );
      errores++;
      continue;
    }

    // El watchtime generado por el bot no puede exceder el tiempo real de actividad
    const correctedBotGenerated = Math.min(
      botGeneratedTotal,
      totalWindowMinutes
    );
    const newTotal = botrixOriginal + correctedBotGenerated;

    if (newTotal === currentTotal) {
      console.log(`  ℹ️  ${nombre}: ${currentTotal} min, sin cambios`);
      sinCambios++;
      continue;
    }

    const diff = currentTotal - newTotal;
    console.log(`  🔧 ${nombre}`);
    console.log(`      Actual : ${currentTotal} min`);
    console.log(`      Nuevo  : ${newTotal} min (-${diff})`);
    console.log(`      Botrix : ${botrixOriginal} min`);
    console.log(
      `      Bot gen: ${botGeneratedTotal} → ${correctedBotGenerated} min`
    );
    console.log(
      `      Ventana: ${totalWindowMinutes} min (${firstMsg.toISOString()} → ${lastMsg.toISOString()})`
    );

    if (!DRY_RUN) {
      await wt.update({ total_watchtime_minutes: newTotal });
      console.log(`      ✅ Actualizado`);
    } else {
      console.log(`      ⏸️  [DRY-RUN] Sin cambios`);
    }

    cambios++;
  }

  console.log("");
  console.log("========================================");
  console.log("RESUMEN");
  console.log("========================================");
  console.log(`Total usuarios migrados : ${usuarios.length}`);
  console.log(`Con cambios             : ${cambios}`);
  console.log(`Sin cambios             : ${sinCambios}`);
  console.log(`Errores / omitidos      : ${errores}`);

  if (DRY_RUN && cambios > 0) {
    console.log("");
    console.log(
      "⚠️  Este fue un DRY-RUN. Ejecuta sin --dry-run para aplicar cambios."
    );
  }

  await sequelize.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});
