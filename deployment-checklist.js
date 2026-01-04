#!/usr/bin/env node

/**
 * 📋 CHECKLIST DE DESPLIEGUE - Max Points y Watchtime
 *
 * Este archivo documenta todos los pasos necesarios para desplegar
 * los sistemas de Max Points y Watchtime en producción.
 *
 * Úsalo como referencia para asegurar que todos los pasos se completen.
 */

const fs = require('fs');
const { execSync } = require('child_process');

const CHECKLIST = [
  {
    id: 1,
    title: "🔍 Verificación Pre-Despliegue",
    subtasks: [
      {
        name: "Verificar que el servidor está pausado",
        command: "docker ps | grep luisardito-backend",
        notes: "Si ves el contenedor corriendo, detenerlo primero"
      },
      {
        name: "Verificar conexión a base de datos",
        command: "docker-compose ps db",
        notes: "La BD debe estar corriendo (estado: Up)"
      },
      {
        name: "Verificar Redis está disponible",
        command: "docker-compose ps | grep redis",
        notes: "Redis debe estar en estado Up"
      },
      {
        name: "Ejecutar script de verificación",
        command: "node verify-implementation.js",
        notes: "Debe mostrar ✅ Verificación completada"
      }
    ]
  },
  {
    id: 2,
    title: "💾 Aplicar Migraciones",
    subtasks: [
      {
        name: "Opción A: Usar Sequelize CLI (recomendado)",
        command: "npm run migrate",
        notes: "Esto aplica TODAS las migraciones pendientes"
      },
      {
        name: "O Opción B: Script SQL directo",
        command: "docker-compose exec db mysql -u app -papp luisardito_shop < migrations/manual-apply-max-puntos-watchtime.sql",
        notes: "Si la opción A falla, usar esta"
      },
      {
        name: "Verificar que las migraciones se aplicaron",
        command: "docker-compose exec db mysql -u app -papp -e \"DESC usuarios;\" luisardito_shop | grep max_puntos",
        notes: "Debe devolver una fila con 'max_puntos'"
      },
      {
        name: "Verificar tabla user_watchtime",
        command: "docker-compose exec db mysql -u app -papp -e \"DESC user_watchtime;\" luisardito_shop",
        notes: "Debe mostrar la estructura de la tabla"
      }
    ]
  },
  {
    id: 3,
    title: "📝 Inicializar Datos",
    subtasks: [
      {
        name: "Ejecutar script de inicialización",
        command: "node initialize-watchtime.js",
        notes: "Crea registros de watchtime para usuarios existentes"
      },
      {
        name: "Verificar que se crearon registros",
        command: "docker-compose exec db mysql -u app -papp -e \"SELECT COUNT(*) FROM user_watchtime;\" luisardito_shop",
        notes: "Debe mostrar el número de registros creados"
      },
      {
        name: "Verificar max_puntos fue actualizado",
        command: "docker-compose exec db mysql -u app -papp -e \"SELECT COUNT(*) FROM usuarios WHERE max_puntos > 0;\" luisardito_shop",
        notes: "Debe mostrar el número de usuarios con max_puntos"
      }
    ]
  },
  {
    id: 4,
    title: "🚀 Desplegar Servidor",
    subtasks: [
      {
        name: "Reconstruir imágenes (si es necesario)",
        command: "docker-compose build luisardito-backend",
        notes: "Solo necesario si actualizaste Dockerfile"
      },
      {
        name: "Iniciar servidor",
        command: "docker-compose up -d luisardito-backend",
        notes: "Inicia el contenedor en background"
      },
      {
        name: "Esperar a que se inicie correctamente",
        command: "sleep 5 && docker-compose logs --tail 20 luisardito-backend",
        notes: "Debe mostrar logs de inicio sin errores"
      }
    ]
  },
  {
    id: 5,
    title: "🧪 Pruebas de Funcionalidad",
    subtasks: [
      {
        name: "Verificar que la API responde",
        command: "curl http://localhost:3000/api/leaderboard?limit=1",
        notes: "Debe devolver status 200 con datos del leaderboard"
      },
      {
        name: "Verificar que max_puntos está en respuesta",
        command: "curl http://localhost:3000/api/leaderboard?limit=1 | jq '.data[0].max_puntos'",
        notes: "Debe devolver un número (no null)"
      },
      {
        name: "Verificar que watchtime_minutes está en respuesta",
        command: "curl http://localhost:3000/api/leaderboard?limit=1 | jq '.data[0].watchtime_minutes'",
        notes: "Debe devolver un número (no null)"
      },
      {
        name: "Enviar mensaje de prueba en Kick",
        command: "# Manualmente enviar un mensaje en el chat de Kick como usuario registrado",
        notes: "Esperar 10 segundos para que el webhook procese"
      },
      {
        name: "Verificar logs de max_puntos",
        command: "docker-compose logs --tail 50 luisardito-backend | grep \"[MAX POINTS]\"",
        notes: "Debe mostrar al menos un log si se actualizó max_puntos"
      },
      {
        name: "Verificar logs de watchtime",
        command: "docker-compose logs --tail 50 luisardito-backend | grep \"[WATCHTIME]\"",
        notes: "Debe mostrar al menos un log de watchtime"
      },
      {
        name: "Enviar segundo mensaje después de 5 minutos",
        command: "# Esperar 5 minutos y enviar otro mensaje",
        notes: "Verifica que el cooldown funciona correctamente"
      },
      {
        name: "Verificar en BD que se actualizó",
        command: "docker-compose exec db mysql -u app -papp -e \"SELECT puntos, max_puntos FROM usuarios WHERE id = 3;\" luisardito_shop",
        notes: "Debe mostrar valores actualizados"
      }
    ]
  },
  {
    id: 6,
    title: "✅ Validación Final",
    subtasks: [
      {
        name: "Revisar logs sin errores",
        command: "docker-compose logs luisardito-backend | grep \"ERROR\" || echo 'Sin errores'",
        notes: "No debe haber errores críticos"
      },
      {
        name: "Verificar que el servidor está healthy",
        command: "curl http://localhost:3000/api/leaderboard",
        notes: "Status debe ser 200 y success: true"
      },
      {
        name: "Ejecutar verificación final",
        command: "node verify-implementation.js",
        notes: "Debe mostrar ✅ verificación completada"
      },
      {
        name: "Documentar estado en logs",
        command: "echo 'Max Points y Watchtime desplegados exitosamente - $(date)' >> deployment.log",
        notes: "Mantener registro del despliegue"
      }
    ]
  }
];

function printChecklist() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║       📋 CHECKLIST DE DESPLIEGUE - MAX POINTS & WATCHTIME      ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log("\n");

  CHECKLIST.forEach((section, sectionIndex) => {
    console.log(`\n${section.id}. ${section.title}`);
    console.log("━".repeat(70));

    section.subtasks.forEach((task, taskIndex) => {
      const taskNum = `${section.id}.${taskIndex + 1}`;
      console.log(`\n   ☐ [${taskNum}] ${task.name}`);
      console.log(`       Comando: ${task.command}`);
      console.log(`       Nota: ${task.notes}`);
    });
  });

  console.log("\n\n");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║                      🎯 NOTAS IMPORTANTES                       ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`
  1. ⏱️  Tiempo estimado: 30-45 minutos
  2. 📍 Ubicación: Ejecutar desde raíz del proyecto
  3. 🔑 Credenciales BD: usuario=app, password=app
  4. 🌍 Puerto API: http://localhost:3000
  5. 💾 Backup: Hacer backup de BD ANTES de migrar
  6. 📞 Soporte: Ver FAQ-MAX-PUNTOS-WATCHTIME.md
  7. 🐛 Si hay errores: Revisar LEADERBOARD-MAX-PUNTOS-WATCHTIME.md
  8. ↩️  Rollback: Las migraciones son reversibles (down)
  `);

  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║                     📊 PASOS POR SECCIÓN                        ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");

  const stats = {
    total: 0,
    sections: CHECKLIST.length
  };

  CHECKLIST.forEach(section => {
    stats.total += section.subtasks.length;
    console.log(`   ${section.id}. ${section.title}: ${section.subtasks.length} pasos`);
  });

  console.log(`\n   Total: ${stats.total} pasos en ${stats.sections} secciones\n`);
}

function exportChecklist() {
  // Crear versión exportable en markdown
  let markdown = `# 📋 Checklist de Despliegue - Max Points y Watchtime\n\n`;
  markdown += `**Generado:** ${new Date().toISOString()}\n`;
  markdown += `**Total de pasos:** ${CHECKLIST.reduce((sum, s) => sum + s.subtasks.length, 0)}\n\n`;

  CHECKLIST.forEach((section) => {
    markdown += `\n## ${section.id}. ${section.title}\n\n`;
    section.subtasks.forEach((task, i) => {
      markdown += `- [ ] **${task.name}**\n`;
      markdown += `  - \`${task.command}\`\n`;
      markdown += `  - ${task.notes}\n\n`;
    });
  });

  fs.writeFileSync('CHECKLIST-DESPLIEGUE.md', markdown);
  console.log("✅ Checklist exportado a: CHECKLIST-DESPLIEGUE.md\n");
}

// Ejecutar
if (require.main === module) {
  printChecklist();
  exportChecklist();
}

module.exports = { CHECKLIST, printChecklist, exportChecklist };

