# Ejemplos de Uso - Migración de Watchtime

## Configuración

### 1. Activar Migración de Watchtime

```bash
curl -X PUT http://localhost:3000/api/kick-admin/watchtime-migration \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"watchtime_migration_enabled": true}'
```

**Respuesta esperada**:
```json
{
  "success": true,
  "message": "Migración de watchtime activada",
  "config": {
    "watchtime_migration_enabled": true
  }
}
```

### 2. Desactivar Migración de Watchtime

```bash
curl -X PUT http://localhost:3000/api/kick-admin/watchtime-migration \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"watchtime_migration_enabled": false}'
```

### 3. Obtener Configuración Actual

```bash
curl -X GET http://localhost:3000/api/kick-admin/config \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Respuesta esperada**:
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
      "migrated_users": 0,
      "total_minutes_migrated": 0
    }
  },
  "vip": {
    "points_enabled": true,
    "chat_points": 5,
    "follow_points": 100,
    "sub_points": 300,
    "stats": {
      "active_vips": 36,
      "expired_vips": 0
    }
  }
}
```

## Testing de Mensajes

### Patrón 1: Formato Completo

**Mensaje de BotRix**:
```
@NaferJ ha pasado 24 dias 12 horas 15 min viendo este canal
```

**Minutos equivalentes**: (24 × 24 × 60) + (12 × 60) + 15 = **35,295 minutos**

**Respuesta esperada en logs**:
```
✅ [BOTRIX WATCHTIME MIGRATION] Migración completada para NaferJ: 35295 minutos
```

### Patrón 2: Solo Días y Horas

**Mensaje de BotRix**:
```
@usuario ha pasado 5 dias 3 horas viendo este canal
```

**Minutos equivalentes**: (5 × 24 × 60) + (3 × 60) = **7,380 minutos**

### Patrón 3: Solo Minutos

**Mensaje de BotRix**:
```
@usuario ha pasado 45 min viendo este canal
```

**Minutos equivalentes**: 45 minutos

### Patrón 4: Singular

**Mensaje de BotRix**:
```
@usuario ha pasado 1 dia 1 hora 1 min viendo este canal
```

**Minutos equivalentes**: (1 × 24 × 60) + (1 × 60) + 1 = **1,441 minutos**

## Ejemplos de Respuestas

### Migración Exitosa

**En el controlador** `src/controllers/kickWebhook.controller.js`:
```javascript
{
  processed: true,
  reason: 'Migration successful',
  details: {
    usuario_id: 1,
    nickname: 'NaferJ',
    kick_username: 'NaferJ',
    watchtime_minutes_migrated: 35295,
    watchtime_breakdown: { days: 24, hours: 12, minutes: 15 },
    total_watchtime_after_migration: 35295,
    migrated_at: 2026-01-03T15:30:00.000Z
  }
}
```

### Migración Duplicada

```javascript
{
  processed: false,
  reason: 'Already migrated',
  details: {
    targetUsername: 'NaferJ',
    totalWatchtimeMinutes: 35295,
    migrated_at: 2026-01-03T15:30:00.000Z,
    previous_migration: 35295
  }
}
```

### Usuario no Encontrado

```javascript
{
  processed: false,
  reason: 'User not found',
  details: {
    targetUsername: 'UnknownUser',
    totalWatchtimeMinutes: 35295
  }
}
```

### Migración Deshabilitada

```javascript
{
  processed: false,
  reason: 'Watchtime migration disabled'
}
```

## Verificación en Base de Datos

### Verificar Migración en Usuario

```sql
SELECT 
  id,
  nickname,
  botrix_watchtime_migrated,
  botrix_watchtime_migrated_at,
  botrix_watchtime_minutes_migrated
FROM usuarios
WHERE botrix_watchtime_migrated = true
ORDER BY botrix_watchtime_migrated_at DESC
LIMIT 10;
```

### Verificar Watchtime en user_watchtime

```sql
SELECT 
  u.id,
  u.nickname,
  uw.total_watchtime_minutes,
  uw.message_count,
  uw.created_at
FROM usuarios u
JOIN user_watchtime uw ON u.id = uw.usuario_id
WHERE uw.total_watchtime_minutes > 0
ORDER BY uw.total_watchtime_minutes DESC
LIMIT 10;
```

### Estadísticas Generales

```sql
SELECT 
  COUNT(DISTINCT usuario_id) as migrated_users,
  SUM(botrix_watchtime_minutes_migrated) as total_minutes
FROM usuarios
WHERE botrix_watchtime_migrated = true;
```

## Monitoreo de Logs

### Buscar Migraciones Exitosas

```bash
# En los logs de la aplicación
grep "\[BOTRIX WATCHTIME MIGRATION\] Migración completada" app.log
```

### Buscar Errores

```bash
# Buscar errores de migración
grep "❌ \[BOTRIX WATCHTIME MIGRATION\]" app.log
```

### Ver Todo Related a Watchtime

```bash
grep "BOTRIX WATCHTIME" app.log | tail -50
```

## Escenarios de Testing

### Escenario 1: Primer Usuario Migrando

1. Asegurar que `watchtime_migration_enabled: true`
2. Usuario no debe tener `botrix_watchtime_migrated: true`
3. BotRix envía mensaje
4. Sistema crea registro en `user_watchtime`
5. Usuario queda marcado como migrado
6. Intentar migrar de nuevo debe fallar

### Escenario 2: Configuración Desactivada

1. Desactivar migración: `PUT /watchtime-migration` con `false`
2. BotRix envía mensaje
3. Mensaje debe ser ignorado
4. Log debe mostrar "Watchtime migration disabled"

### Escenario 3: Usuario No Existe

1. BotRix envía mensaje para usuario inexistente
2. Sistema busca el usuario
3. Usuario no encontrado en BD
4. Migración falla con razón "User not found"
5. Logs registran el intento

### Escenario 4: Migración Paralela

1. Procesar migración de puntos
2. Procesar migración de watchtime
3. Ambas pueden estar activas simultáneamente
4. Cada una se ejecuta independientemente

## Variables de Entorno (si aplica)

No requiere variables de entorno adicionales. La configuración se maneja a través de:
- Base de datos (`botrix_migration_config`)
- API endpoints (`PUT /api/kick-admin/watchtime-migration`)

## Troubleshooting

### Migración no se procesa

**Causas posibles**:
1. `watchtime_migration_enabled: false` en base de datos
2. Patrón de mensaje no coincide con regex
3. Usuario no existe en base de datos
4. Usuario ya migró anteriormente

**Solución**:
1. Verificar configuración: `GET /api/kick-admin/config`
2. Revisar logs: Buscar mensajes de debug
3. Verificar usuario existe: `SELECT * FROM usuarios WHERE nickname = 'username'`
4. Verificar si ya migró: `botrix_watchtime_migrated` debe ser `false`

### Total de minutos incorrectos

**Causas posibles**:
1. Conversión incorrecta de días/horas/minutos
2. Base de datos con datos previos

**Solución**:
1. Verificar cálculo manual: (días × 1440) + (horas × 60) + minutos
2. Revisar valor en `botrix_watchtime_minutes_migrated`
3. Verificar valor en `user_watchtime.total_watchtime_minutes`

## Documentación Completa

Ver `WATCHTIME-MIGRATION-IMPLEMENTATION.md` para documentación técnica completa.

