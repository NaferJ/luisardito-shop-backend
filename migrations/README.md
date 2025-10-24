# Migraciones de Base de Datos

Este directorio contiene las migraciones de Sequelize para el proyecto Luisardito Shop.

## Estado Actual

✅ **PROBLEMA RESUELTO**: Las migraciones ahora reflejan correctamente la estructura de la base de datos.

### Migraciones Disponibles

1. `20250101000001-create-auth-tables.js` - Crea tablas de autenticación (roles, permisos, rol_permisos)
2. `20250101000002-create-core-tables.js` - Crea tablas principales (usuarios, productos, canjes, historial_puntos)
3. `20250101000003-create-refresh-tokens.js` - Crea tabla de refresh tokens
4. `20250101000004-create-kick-tables-1.js` - Crea tablas de integración con Kick (parte 1)
5. `20250101000005-create-kick-tables-2.js` - Crea tablas de integración con Kick (parte 2)
6. `20251011011630-allow-null-password-hash.js` - Permite NULL en password_hash (para usuarios de Kick)

## Comandos Útiles

### Desarrollo Local
```bash
# Ver estado de migraciones
npm run migrate:status

# Ejecutar migraciones pendientes
npm run migrate

# Ejecutar seeders
npm run seed

# Configurar DB completa
npm run setup-db

# Reset completo de DB
npm run reset-db
```

### Verificar Estado en Docker
```bash
# Ver migraciones registradas
docker exec -it luisardito-mysql mysql -u app -papp luisardito_shop -e "SELECT * FROM SequelizeMeta ORDER BY name;"

# Ver todas las tablas
docker exec -it luisardito-mysql mysql -u app -papp luisardito_shop -e "SHOW TABLES;"
```

### Para Entornos de Producción

Si necesitas sincronizar las migraciones en un entorno donde las tablas ya existen:

**Windows (PowerShell):**
```powershell
.\sync-migrations.ps1 register
.\sync-migrations.ps1 status
```

**Linux/Mac:**
```bash
./sync-migrations.sh register
./sync-migrations.sh status
```

## Estructura de la Base de Datos

### Tablas Principales
- `usuarios` - Información de usuarios (local + Kick)
- `productos` - Catálogo de productos para canje
- `canjes` - Historial de canjes realizados
- `historial_puntos` - Movimientos de puntos detallados

### Autenticación
- `roles` - Roles del sistema (usuario, admin, etc.)
- `permisos` - Permisos granulares
- `rol_permisos` - Relación many-to-many entre roles y permisos
- `refresh_tokens` - Tokens de refresco para autenticación

### Integración con Kick
- `kick_points_config` - Configuración de puntos por eventos
- `kick_broadcaster_tokens` - Tokens OAuth de streamers
- `kick_event_subscriptions` - Suscripciones a eventos de Kick
- `kick_webhook_events` - Log de eventos recibidos de Kick
- `kick_user_tracking` - Seguimiento de usuarios de Kick
- `kick_chat_cooldowns` - Control de cooldown para puntos por chat

## Notas Importantes

1. **Todas las migraciones están sincronizadas** con el estado actual de la base de datos
2. **Nuevas migraciones** deben crearse con `npx sequelize migration:generate --name nombre-descriptivo`
3. **En producción** asegúrate de ejecutar las migraciones antes de deployar código nuevo
4. **Los seeders** están disponibles para datos iniciales (roles, permisos, productos de ejemplo)

## Troubleshooting

### Error: "Table already exists"
- Las tablas ya existen pero no están registradas en migraciones
- Usar los scripts `sync-migrations.*` para registrar migraciones existentes

### Error: "Cannot connect to database"
- Verificar que el contenedor de MySQL esté ejecutándose: `docker ps`
- Verificar variables de entorno en `.env`
- Para desarrollo local, usar `DB_HOST=localhost` y `DB_PORT=3307`

### Verificar Consistencia
```sql
-- Verificar que todas las tablas tienen las columnas correctas
DESCRIBE usuarios;
DESCRIBE kick_broadcaster_tokens;
DESCRIBE refresh_tokens;
```
