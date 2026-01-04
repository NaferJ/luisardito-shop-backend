# 🎯 Resumen de Implementación - Migración de Watchtime desde Botrix

## 📌 Estado: ✅ COMPLETADO

---

## 🎁 ¿Qué se Implementó?

Se agregó una nueva funcionalidad que **migra automáticamente el watchtime (tiempo de visualización) desde el bot Botrix** a la plataforma, de forma similar a como ya existe la migración de puntos.

### Características Principales:

1. **Detección Automática** - Detecta mensajes de BotRix con patrón: `@usuario ha pasado X dias Y horas Z min viendo este canal`
2. **Conversión Inteligente** - Convierte días/horas/minutos a minutos totales
3. **Control de Duplicados** - Solo se migra una vez por usuario
4. **Configurable** - Se puede activar/desactivar desde API
5. **Estadísticas** - Muestra estadísticas de migración en endpoint de configuración
6. **Transaccional** - Garantiza consistencia de datos

---

## 🔄 Flujo de Funcionamiento

```
┌─────────────────────────────────────────────────┐
│  BotRix envía mensaje en chat                   │
│  "@usuario ha pasado 24 dias 12 horas 15 min..." │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│  Webhook recibe mensaje                         │
│  (kickWebhook.controller.js)                    │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│  Verifica configuración                         │
│  watchtime_migration_enabled = true?            │
└────────────┬────────────────────────────────────┘
             │
      ┌──────┴──────┐
      │             │
     SÍ            NO → IGNORAR
      │
      ▼
┌─────────────────────────────────────────────────┐
│  Detecta patrón con REGEX                       │
│  Extrae: días, horas, minutos                   │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│  Busca usuario en base de datos                 │
│  Por nickname o kick_data.username              │
└────────────┬────────────────────────────────────┘
             │
      ┌──────┴──────────────┐
      │                     │
   ENCONTRADO           NO ENCONTRADO → ERROR
      │
      ▼
┌─────────────────────────────────────────────────┐
│  Verifica si ya migró                           │
│  botrix_watchtime_migrated = false?             │
└────────────┬────────────────────────────────────┘
             │
      ┌──────┴──────────────┐
      │                     │
   NUEVO                YA MIGRÓ → ERROR
      │
      ▼
┌─────────────────────────────────────────────────┐
│  Inicia TRANSACCIÓN                             │
│  ┌──────────────────────────────────────┐       │
│  │ 1. Crea/Actualiza en user_watchtime  │       │
│  │ 2. Suma minutos de watchtime         │       │
│  │ 3. Marca usuario como migrado        │       │
│  │ 4. Guarda fecha y cantidad           │       │
│  └──────────────────────────────────────┘       │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│  ✅ MIGRACIÓN COMPLETADA                        │
│  Retorna detalles de la migración               │
└─────────────────────────────────────────────────┘
```

---

## 📊 Datos Almacenados

### En tabla `usuarios`:
```
┌──────────────────────────────────────┐
│ Campo                                │ Tipo     │ Ejemplo
├──────────────────────────────────────┤
│ botrix_watchtime_migrated            │ BOOLEAN  │ true
│ botrix_watchtime_migrated_at         │ DATE     │ 2026-01-03 15:30:00
│ botrix_watchtime_minutes_migrated    │ INTEGER  │ 35295
└──────────────────────────────────────┘
```

### En tabla `user_watchtime`:
```
┌──────────────────────────────────────┐
│ Campo                                │ Tipo     │ Ejemplo
├──────────────────────────────────────┤
│ usuario_id                           │ INTEGER  │ 42
│ total_watchtime_minutes              │ INTEGER  │ 35295 (actualizado)
│ message_count                        │ INTEGER  │ 0
│ created_at / updated_at              │ DATE     │ 2026-01-03 15:30:00
└──────────────────────────────────────┘
```

### En tabla `botrix_migration_config`:
```
┌──────────────────────────────────────┐
│ Campo                                │ Tipo     │ Default
├──────────────────────────────────────┤
│ watchtime_migration_enabled          │ BOOLEAN  │ true
└──────────────────────────────────────┘
```

---

## 🔐 Endpoints API

### 1. GET `/api/kick-admin/config`
**Obtiene la configuración actual**

**Ejemplo de respuesta**:
```json
{
  "success": true,
  "migration": {
    "enabled": true,
    "stats": {
      "migrated_users": 257,
      "total_points_migrated": 29339455
    }
  },
  "watchtime_migration": {
    "enabled": true,
    "stats": {
      "migrated_users": 10,
      "total_minutes_migrated": 352950
    }
  },
  "vip": { ... }
}
```

### 2. PUT `/api/kick-admin/watchtime-migration`
**Activa/desactiva la migración de watchtime**

**Solicitud**:
```bash
curl -X PUT http://localhost:3000/api/kick-admin/watchtime-migration \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"watchtime_migration_enabled": false}'
```

**Respuesta**:
```json
{
  "success": true,
  "message": "Migración de watchtime desactivada",
  "config": {
    "watchtime_migration_enabled": false
  }
}
```

---

## 📝 Ejemplo de Migración

### Entrada (Mensaje de BotRix):
```
@NaferJ ha pasado 24 dias 12 horas 15 min viendo este canal
```

### Cálculo:
```
Días:     24 × 24 × 60 = 34,560 minutos
Horas:    12 × 60      =    720 minutos
Minutos:  15           =     15 minutos
                       ───────────────
Total:                = 35,295 minutos
```

### Salida (Base de datos):
```sql
UPDATE usuarios 
SET 
  botrix_watchtime_migrated = true,
  botrix_watchtime_migrated_at = NOW(),
  botrix_watchtime_minutes_migrated = 35295
WHERE id = (SELECT id FROM usuarios WHERE nickname = 'NaferJ');

UPDATE user_watchtime 
SET 
  total_watchtime_minutes = 35295
WHERE usuario_id = (SELECT id FROM usuarios WHERE nickname = 'NaferJ');
```

---

## 🛠️ Archivos Modificados/Creados

### Creados:
- ✅ `migrations/20260103000004-add-watchtime-migration-fields.js`
- ✅ `WATCHTIME-MIGRATION-IMPLEMENTATION.md`
- ✅ `WATCHTIME-MIGRATION-EJEMPLOS.md`
- ✅ `WATCHTIME-MIGRATION-CHECKLIST.md`

### Modificados:
- ✅ `src/models/usuario.model.js` (+3 campos)
- ✅ `src/models/botrixMigrationConfig.model.js` (+1 campo)
- ✅ `src/services/botrixMigration.service.js` (+3 métodos)
- ✅ `src/controllers/kickAdmin.controller.js` (+1 método, +estadísticas)
- ✅ `src/routes/kickAdmin.routes.js` (+1 ruta)
- ✅ `src/controllers/kickWebhook.controller.js` (+procesamiento)

---

## 🎯 Características

| Feature | Estado |
|---------|--------|
| Detección de patrón | ✅ Implementado |
| Conversión a minutos | ✅ Implementado |
| Almacenamiento en BD | ✅ Implementado |
| Control de duplicados | ✅ Implementado |
| Transacciones | ✅ Implementado |
| Configuración activable | ✅ Implementado |
| Estadísticas | ✅ Implementado |
| Endpoint de config | ✅ Actualizado |
| Logs | ✅ Implementado |
| Validaciones | ✅ Implementado |

---

## 🚀 Pasos para Usar

### 1. Aplicar migración:
```bash
npm run migrate
```

### 2. Verificar que esté activado (default: true):
```bash
curl http://localhost:3000/api/kick-admin/config
```

### 3. (Opcional) Desactivar si es necesario:
```bash
curl -X PUT http://localhost:3000/api/kick-admin/watchtime-migration \
  -H "Content-Type: application/json" \
  -d '{"watchtime_migration_enabled": false}'
```

### 4. BotRix enviará mensaje automáticamente:
```
@usuario ha pasado 24 dias 12 horas 15 min viendo este canal
```

### 5. Sistema migrará automáticamente ✨

---

## 🔍 Monitoreo

### Ver migraciones en logs:
```
✅ [BOTRIX WATCHTIME MIGRATION] Migración completada para NaferJ: 35295 minutos
```

### Verificar en base de datos:
```sql
SELECT 
  nickname,
  botrix_watchtime_migrated,
  botrix_watchtime_minutes_migrated,
  botrix_watchtime_migrated_at
FROM usuarios
WHERE botrix_watchtime_migrated = true
ORDER BY botrix_watchtime_migrated_at DESC
LIMIT 10;
```

---

## ⚠️ Limitaciones y Notas

1. **Irreversible**: Una vez migrado, no se puede deshacer (por diseño)
2. **Una sola vez**: Mismo usuario no puede migrar dos veces
3. **Independiente**: No afecta la migración de puntos
4. **Configurable**: Se puede desactivar en cualquier momento (pero no deshace migraciones previas)
5. **Conversión fija**: Usa 60 minutos/hora y 24 horas/día (estándar)

---

## 📚 Documentación Completa

Para más detalles, ver:
- `WATCHTIME-MIGRATION-IMPLEMENTATION.md` - Documentación técnica
- `WATCHTIME-MIGRATION-EJEMPLOS.md` - Ejemplos de uso
- `WATCHTIME-MIGRATION-CHECKLIST.md` - Checklist de implementación

---

## ✨ Conclusión

La funcionalidad está **lista para usar**. Solo necesita:
1. Ejecutar la migración: `npm run migrate`
2. Dejar que BotRix envíe mensajes cuando usuarios pregunten `!watchtime`
3. El sistema migrará automáticamente

**No requiere cambios adicionales en el frontend o en otra parte del sistema.**

---

**Implementado por**: GitHub Copilot
**Fecha**: 2026-01-03
**Estado**: ✅ Completo y Listo para Producción

