# 🚀 Guía Rápida - Migración de Watchtime

## ⚡ TL;DR (Too Long; Didn't Read)

Se agregó funcionalidad para migrar watchtime desde Botrix. **Está lista para usar**, solo ejecuta:

```bash
npm run migrate
```

Listo. El sistema migrará automáticamente cuando BotRix envíe mensajes como:
```
@usuario ha pasado 24 dias 12 horas 15 min viendo este canal
```

---

## 📋 Checklist de Verificación Rápida

```bash
# 1. Verificar que la migración se aplicó
npm run migrate

# 2. Verificar que está activado
curl http://localhost:3000/api/kick-admin/config

# 3. Ver en respuesta (debe estar presente):
# "watchtime_migration": {
#   "enabled": true,
#   "stats": { ... }
# }

# 4. Listo! Ya funciona automáticamente
```

---

## 🔧 Comandos Útiles

### Activar/Desactivar Migración
```bash
# Desactivar
curl -X PUT http://localhost:3000/api/kick-admin/watchtime-migration \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"watchtime_migration_enabled": false}'

# Activar
curl -X PUT http://localhost:3000/api/kick-admin/watchtime-migration \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"watchtime_migration_enabled": true}'
```

### Verificar Estadísticas
```bash
curl http://localhost:3000/api/kick-admin/config \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Ver Usuarios Migrados en BD
```bash
# MySQL
SELECT nickname, botrix_watchtime_minutes_migrated, botrix_watchtime_migrated_at
FROM usuarios
WHERE botrix_watchtime_migrated = true
ORDER BY botrix_watchtime_migrated_at DESC
LIMIT 10;
```

---

## 📊 Conversión de Tiempo

```
24 dias 12 horas 15 min
= (24 × 1440) + (12 × 60) + 15
= 34,560 + 720 + 15
= 35,295 minutos ✅
```

**Fórmula**: `total_minutos = (días × 1440) + (horas × 60) + minutos`

---

## 🎯 Casos de Uso

### ✅ Debe Funcionar
```
@NaferJ ha pasado 24 dias 12 horas 15 min viendo este canal
@usuario ha pasado 5 dias viendo este canal
@usuario ha pasado 3 horas viendo este canal
@usuario ha pasado 45 min viendo este canal
@usuario ha pasado 1 dia 1 hora 1 min viendo este canal
```

### ❌ No Funcionará
```
@usuario tiene 35295 minutos  (patrón de puntos, no watchtime)
@usuario ha estado 24 horas   (formato diferente)
usuario ha pasado 1 dia       (sin el @)
```

---

## 🚨 Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| No migra | Verificar `watchtime_migration_enabled = true` en config |
| No encuentra usuario | Asegurar que existe en BD con ese nickname |
| Migra dos veces | No debería pasar (hay protección), pero revisar logs |
| Números incorrectos | Verificar conversión: (días × 1440) + (horas × 60) + min |

---

## 📍 Archivos Principales

```
src/
├── models/
│   ├── usuario.model.js               ← Nuevos campos
│   └── botrixMigrationConfig.model.js ← Nueva configuración
├── services/
│   └── botrixMigration.service.js     ← Lógica de migración
├── controllers/
│   ├── kickAdmin.controller.js        ← Nuevos endpoints
│   └── kickWebhook.controller.js      ← Procesamiento
└── routes/
    └── kickAdmin.routes.js            ← Nueva ruta

migrations/
└── 20260103000004-add-watchtime-migration-fields.js ← BD
```

---

## 🔐 Seguridad

- ✅ Requiere autenticación (bearer token)
- ✅ Requiere permiso `gestionar_usuarios`
- ✅ No se puede migrar dos veces
- ✅ Usa transacciones para consistencia

---

## 📚 Documentación Completa

Para más detalles, ver archivos markdown:
- **`RESUMEN-WATCHTIME-MIGRATION.md`** ← Aquí estás
- **`WATCHTIME-MIGRATION-IMPLEMENTATION.md`** - Documentación técnica
- **`WATCHTIME-MIGRATION-EJEMPLOS.md`** - Ejemplos de uso
- **`WATCHTIME-MIGRATION-CHECKLIST.md`** - Checklist de implementación

---

## ✨ ¿Qué Cambió?

### Tabla `usuarios` (+3 campos):
```sql
botrix_watchtime_migrated           BOOLEAN
botrix_watchtime_migrated_at        DATE
botrix_watchtime_minutes_migrated   INTEGER
```

### Tabla `botrix_migration_config` (+1 campo):
```sql
watchtime_migration_enabled         BOOLEAN (default: true)
```

### API (+1 endpoint):
```
PUT /api/kick-admin/watchtime-migration
```

### Respuesta de Config (actualizada):
```json
"watchtime_migration": {
  "enabled": true,
  "stats": { ... }
}
```

---

## ⏱️ Resumen Temporal

```
┌─────────────────────────────────────┐
│ BotRix: "@usuario ha pasado 24..."  │
└────────────┬────────────────────────┘
             │ Sistema detecta automáticamente
             ▼
┌─────────────────────────────────────┐
│ Convierte a minutos: 35,295 min     │
└────────────┬────────────────────────┘
             │ Crea/Actualiza en BD
             ▼
┌─────────────────────────────────────┐
│ ✅ Migración completada             │
│ Watchtime actualizado               │
└─────────────────────────────────────┘
```

---

## 🎉 ¡Listo!

**La funcionalidad está completamente implementada y lista para usar.**

Solo necesitas:
1. `npm run migrate` ✅
2. Dejar que funcione automáticamente ✅

**¿Preguntas?** Ver documentación completa en los archivos markdown incluidos.

---

**Última actualización**: 2026-01-03
**Estado**: ✅ Listo para Producción

