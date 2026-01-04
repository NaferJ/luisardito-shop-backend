# Implementación: Migración de Watchtime desde Botrix

## Descripción

Se ha implementado una nueva funcionalidad que permite migrar el watchtime (tiempo de visualización) desde el bot Botrix. Similar a la migración de puntos existente, esta funcionalidad:

- Detecta mensajes de chat de BotRix con el patrón: `@usuario ha pasado X dias Y horas Z min viendo este canal`
- Convierte días/horas/minutos a minutos totales
- Migra el watchtime a la tabla `user_watchtime` de cada usuario
- Permite que solo se migre una vez por usuario (control de duplicados)
- Es configurable para activar/desactivar desde endpoints de API
- Devuelve estadísticas de migración en el endpoint de configuración

## Cambios Realizados

### 1. Base de Datos

**Archivo creado**: `migrations/20260103000004-add-watchtime-migration-fields.js`

Agrega los siguientes campos:
- `usuarios.botrix_watchtime_migrated` (BOOLEAN) - Indica si el usuario migró watchtime
- `usuarios.botrix_watchtime_migrated_at` (DATE) - Fecha de la migración
- `usuarios.botrix_watchtime_minutes_migrated` (INTEGER) - Minutos migrados
- `botrix_migration_config.watchtime_migration_enabled` (BOOLEAN) - Habilita/deshabilita la migración

### 2. Modelos

#### `src/models/usuario.model.js`
- Agregados 3 campos para rastrear migración de watchtime
- Agregado método `canMigrateWatchtime()` para verificar si el usuario puede migrar

#### `src/models/botrixMigrationConfig.model.js`
- Agregado campo `watchtime_migration_enabled` (default: true)
- Actualizado método `getConfig()` para incluir el nuevo campo
- Actualizado método `setConfig()` para inicializar el campo

### 3. Servicios

#### `src/services/botrixMigration.service.js`

**Nuevo método: `processWatchtimeMessage(chatMessage)`**
- Verifica que el mensaje venga de BotRix
- Verifica que la migración de watchtime esté habilitada
- Detecta el patrón de watchtime usando regex flexible
- Busca el usuario en la base de datos
- Verifica que no haya migrado antes
- Llama a `migrateWatchtime()` para realizar la migración

**Nuevo método: `migrateWatchtime(usuario, totalWatchtimeMinutes, kickUsername, breakdown)`**
- Obtiene o crea registro en `user_watchtime`
- Convierte y suma los minutos de watchtime
- Actualiza el usuario con banderas de migración
- Ejecuta dentro de una transacción para garantizar consistencia
- Retorna detalles de la migración

**Nuevo método: `getWatchtimeMigrationStats()`**
- Retorna estadísticas de migración:
  - Total de usuarios
  - Usuarios migrados
  - Usuarios pendientes
  - Porcentaje de migración
  - Total de minutos migrados
  - Estado de habilitación

### 4. Controladores

#### `src/controllers/kickAdmin.controller.js`

**Actualizado: `getConfig()`**
- Ahora incluye estadísticas de migración de watchtime en la respuesta
- Retorna `watchtime_migration` con:
  - `enabled`: Estado de la migración
  - `stats`: Usuarios migrados y minutos totales migrados

**Nuevo método: `updateWatchtimeMigrationConfig(req, res)`**
- Permite activar/desactivar la migración de watchtime
- Acepta parámetro `watchtime_migration_enabled` (boolean o string "true"/"false")
- Maneja errores y validaciones

### 5. Rutas

#### `src/routes/kickAdmin.routes.js`

**Nueva ruta**:
```
PUT /api/kick-admin/watchtime-migration
```
- Requiere permiso: `gestionar_usuarios`
- Controller: `updateWatchtimeMigrationConfig`

### 6. Webhooks

#### `src/controllers/kickWebhook.controller.js`

**Actualizado: Procesamiento de mensajes de chat**
- Ahora procesa primero la migración de puntos
- Luego procesa la migración de watchtime
- Ambos se pueden activar/desactivar independientemente

## Conversión de Tiempo

La conversión de watchtime a minutos utiliza la siguiente fórmula:

```
total_minutos = (días × 24 × 60) + (horas × 60) + minutos
```

Ejemplo:
- 24 días 12 horas 15 minutos
- = (24 × 24 × 60) + (12 × 60) + 15
- = 34,560 + 720 + 15
- = **35,295 minutos**

## Patrón de Detección

El regex utilizado detecta varios formatos:

```
@usuario ha pasado [X dias] [Y horas] [Z min] viendo este canal
```

Ejemplos válidos:
- `@usuario ha pasado 24 dias 12 horas 15 min viendo este canal`
- `@usuario ha pasado 1 dia 5 horas 30 min viendo este canal`
- `@usuario ha pasado 0 dias 3 horas 45 min viendo este canal`
- `@usuario ha pasado 24 dias viendo este canal`
- `@usuario ha pasado 5 horas viendo este canal`

## Respuesta de API de Configuración

El endpoint `GET /api/kick-admin/config` ahora retorna:

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

## Endpoints

### GET `/api/kick-admin/config`
Obtiene la configuración actual incluyendo estadísticas de migración de watchtime.

**Respuesta**:
```json
{
  "success": true,
  "watchtime_migration": {
    "enabled": true,
    "stats": {
      "migrated_users": 10,
      "total_minutes_migrated": 352950
    }
  }
}
```

### PUT `/api/kick-admin/watchtime-migration`
Activa o desactiva la migración de watchtime.

**Cuerpo de solicitud**:
```json
{
  "watchtime_migration_enabled": false
}
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

## Logs de Sistema

El sistema registra todos los eventos en logs:

- `🔄 [BOTRIX WATCHTIME MIGRATION]` - Detección de mensaje de watchtime
- `❌ [BOTRIX WATCHTIME MIGRATION]` - Error en la migración
- `⚠️ [BOTRIX WATCHTIME MIGRATION]` - Usuario ya migró
- `✅ [BOTRIX WATCHTIME MIGRATION]` - Migración completada

## Flujo de Ejecución

1. **Recepción de mensaje de chat**
   - Webhook recibe mensaje de BotRix

2. **Verificación de configuración**
   - Se obtiene la configuración de `BotrixMigrationConfig`
   - Se verifica si `watchtime_migration_enabled` está activo

3. **Detección de patrón**
   - Se aplica el regex al contenido del mensaje
   - Se extraen días, horas y minutos

4. **Búsqueda de usuario**
   - Se busca el usuario por nickname o kick_data.username

5. **Validación de migración**
   - Se verifica que no haya migrado antes

6. **Ejecución de migración**
   - Se crea o actualiza registro en `user_watchtime`
   - Se actualiza usuario con banderas de migración
   - Se ejecuta en transacción para consistencia

7. **Logging**
   - Se registran detalles de la migración

## Notas Importantes

- La migración es **irreversible** - una vez que un usuario migra, no puede volver a hacerlo
- El sistema es **independiente** de la migración de puntos - se pueden activar/desactivar por separado
- La conversión usa **60 minutos por hora** y **24 horas por día** (estándar)
- El regex es **flexible** para manejar variaciones en singular/plural y puntuación
- Las transacciones garantizan **consistencia** en la base de datos

## Testing

Para probar la funcionalidad:

1. Activar la migración de watchtime:
   ```
   PUT /api/kick-admin/watchtime-migration
   Body: { "watchtime_migration_enabled": true }
   ```

2. Enviar mensaje desde BotRix:
   ```
   @usuario ha pasado 24 dias 12 horas 15 min viendo este canal
   ```

3. Verificar estadísticas:
   ```
   GET /api/kick-admin/config
   ```

4. Verificar datos del usuario:
   ```
   GET /api/usuarios/:id
   ```
   Debería mostrar:
   - `botrix_watchtime_migrated: true`
   - `botrix_watchtime_migrated_at: <fecha>`
   - `botrix_watchtime_minutes_migrated: 35295`

## Próximos Pasos (Opcionales)

- [ ] Implementar endpoint para deshacer migración (si es necesario)
- [ ] Agregar estadísticas por fecha de migración
- [ ] Crear dashboard para visualizar progreso de migración
- [ ] Implementar reintentos automáticos para migraciones fallidas

