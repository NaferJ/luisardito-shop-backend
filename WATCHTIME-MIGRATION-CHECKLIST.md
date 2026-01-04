# Checklist de Implementación - Migración de Watchtime

## ✅ Archivos Creados

- [x] `migrations/20260103000004-add-watchtime-migration-fields.js`
  - Agrega campos a tabla `usuarios`
  - Agrega campo a tabla `botrix_migration_config`

- [x] `WATCHTIME-MIGRATION-IMPLEMENTATION.md`
  - Documentación técnica completa
  - Explicación de cambios
  - Ejemplos de respuesta de API

- [x] `WATCHTIME-MIGRATION-EJEMPLOS.md`
  - Ejemplos de uso práctico
  - Comandos curl
  - Escenarios de testing
  - Troubleshooting

## ✅ Archivos Modificados

### Base de Datos y Modelos

- [x] `src/models/usuario.model.js`
  - ✅ Agregados campos para migración de watchtime
    - `botrix_watchtime_migrated`
    - `botrix_watchtime_migrated_at`
    - `botrix_watchtime_minutes_migrated`
  - ✅ Agregado método `canMigrateWatchtime()`

- [x] `src/models/botrixMigrationConfig.model.js`
  - ✅ Agregado campo `watchtime_migration_enabled`
  - ✅ Actualizado método `getConfig()` con nuevo campo
  - ✅ Actualizado método `setConfig()` con nuevo campo

### Servicios

- [x] `src/services/botrixMigration.service.js`
  - ✅ Importado `UserWatchtime`
  - ✅ Agregado método `processWatchtimeMessage()`
    - Detecta patrón de watchtime
    - Valida configuración
    - Busca usuario
    - Verifica duplicados
  - ✅ Agregado método `migrateWatchtime()`
    - Crea/actualiza registro en `user_watchtime`
    - Actualiza usuario
    - Usa transacciones
  - ✅ Agregado método `getWatchtimeMigrationStats()`

### Controladores

- [x] `src/controllers/kickAdmin.controller.js`
  - ✅ Actualizado método `getConfig()`
    - Agrega estadísticas de watchtime
    - Retorna `watchtime_migration` en respuesta
  - ✅ Agregado método `updateWatchtimeMigrationConfig()`
    - Permite activar/desactivar migración
    - Valida entrada
    - Maneja errores

### Rutas

- [x] `src/routes/kickAdmin.routes.js`
  - ✅ Agregada ruta `PUT /api/kick-admin/watchtime-migration`
  - ✅ Configurado middleware de autenticación y permisos

### Webhooks

- [x] `src/controllers/kickWebhook.controller.js`
  - ✅ Agregado procesamiento de mensajes de watchtime
  - ✅ Procesamiento independiente de puntos
  - ✅ Logs adecuados

## 📋 Verificaciones Técnicas

### Imports y Dependencias
- [x] `UserWatchtime` importado en servicio
- [x] `BotrixMigrationConfig` disponible en todos los lugares necesarios
- [x] `sequelize` disponible para transacciones

### Estructura de Código
- [x] Métodos utilizan transacciones para consistencia
- [x] Errores manejados correctamente
- [x] Logs informativos en todos los puntos clave
- [x] Validaciones de entrada en controladores

### Compatibilidad
- [x] Sigue el mismo patrón que migración de puntos
- [x] Compatible con configuración existente
- [x] No afecta funcionalidad de puntos o VIP
- [x] Se puede activar/desactivar independientemente

## 🔍 Puntos Clave de la Implementación

### Conversión de Tiempo
```
total_minutos = (días × 24 × 60) + (horas × 60) + minutos
```

### Patrón de Detección
```
@usuario ha pasado [X dias] [Y horas] [Z min] viendo este canal
```
Flexible para manejar variaciones en singular/plural

### Control de Duplicados
- Campo `botrix_watchtime_migrated` = `false` permite migrar
- Campo `botrix_watchtime_migrated` = `true` rechaza migración

### Transacciones
- Ambas operaciones (crear/actualizar watchtime + actualizar usuario) en una transacción
- Si falla una, se revierte todo
- Garantiza consistencia de datos

## 🚀 Próximos Pasos para Usar

### 1. Aplicar Migración
```bash
npm run migrate
```

### 2. Verificar Configuración
```bash
GET /api/kick-admin/config
```

Debe mostrar `watchtime_migration` con `enabled: true` (por defecto)

### 3. Activar/Desactivar (Opcional)
```bash
PUT /api/kick-admin/watchtime-migration
Body: { "watchtime_migration_enabled": true/false }
```

### 4. Testing
Ver `WATCHTIME-MIGRATION-EJEMPLOS.md` para ejemplos de testing

## 📊 Respuesta de API Actualizada

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
  "vip": { ... }
}
```

## 🔒 Seguridad

- [x] Requiere autenticación (bearer token)
- [x] Requiere permiso `gestionar_usuarios`
- [x] Validación de entrada en todos los endpoints
- [x] Transacciones para evitar estados inconsistentes
- [x] Logs para auditoría

## 📝 Documentación

- [x] Código comentado en todos los métodos nuevos
- [x] Documentación técnica completa en `WATCHTIME-MIGRATION-IMPLEMENTATION.md`
- [x] Ejemplos prácticos en `WATCHTIME-MIGRATION-EJEMPLOS.md`
- [x] Documentación de este checklist

## ⚠️ Notas Importantes

1. **Migración Irreversible**: Una vez que un usuario migra, no puede hacerlo de nuevo
2. **Independiente**: La migración de watchtime no afecta la migración de puntos
3. **Configurable**: Se puede activar/desactivar en cualquier momento
4. **Sin Rollback Automático**: Si se aplica la migración y luego se desactiva, los datos permanecen

## 🧪 Testing Recomendado

1. **Unitario**: Verificar métodos de servicio en aislamiento
2. **Integración**: Probar flujo completo con mensajes de webhook
3. **Base de Datos**: Verificar que los datos se guardan correctamente
4. **API**: Probar endpoints con diferentes parámetros
5. **Configuración**: Verificar que activar/desactivar funciona correctamente

## 📞 Soporte

Para preguntas o problemas:
1. Revisar logs de aplicación
2. Consultar ejemplos en `WATCHTIME-MIGRATION-EJEMPLOS.md`
3. Verificar documentación técnica en `WATCHTIME-MIGRATION-IMPLEMENTATION.md`
4. Revisar código de servicio en `src/services/botrixMigration.service.js`

---

**Estado**: ✅ Implementación Completa
**Fecha**: 2026-01-03
**Versión**: 1.0

