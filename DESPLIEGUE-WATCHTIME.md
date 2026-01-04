# 📋 Checklist de Despliegue - Migración de Watchtime

## Pre-Despliegue

### ✅ Verificación de Código

- [ ] `git status` - Ver cambios pendientes
- [ ] Revisar todos los archivos modificados
- [ ] Verificar que no hay cambios accidentales
- [ ] Verificar imports correctos

```bash
# Validar que no hay errores de sintaxis
npm run lint
```

### ✅ Verificación de Base de Datos

- [ ] Backup de base de datos producción
  ```bash
  mysqldump -u user -p database > backup-$(date +%Y%m%d-%H%M%S).sql
  ```

- [ ] Verificar que las migraciones se pueden ejecutar en local primero
  ```bash
  npm run migrate
  ```

### ✅ Archivos Nuevos Verificados

- [x] `migrations/20260103000004-add-watchtime-migration-fields.js` ✅
- [x] `WATCHTIME-MIGRATION-IMPLEMENTATION.md` ✅
- [x] `WATCHTIME-MIGRATION-EJEMPLOS.md` ✅
- [x] `WATCHTIME-MIGRATION-CHECKLIST.md` ✅
- [x] `RESUMEN-WATCHTIME-MIGRATION.md` ✅
- [x] `GUIA-RAPIDA-WATCHTIME.md` ✅
- [x] `CAMBIOS-CODIGO-WATCHTIME.md` ✅

### ✅ Archivos Modificados Verificados

- [x] `src/models/usuario.model.js` ✅
- [x] `src/models/botrixMigrationConfig.model.js` ✅
- [x] `src/services/botrixMigration.service.js` ✅
- [x] `src/controllers/kickAdmin.controller.js` ✅
- [x] `src/routes/kickAdmin.routes.js` ✅
- [x] `src/controllers/kickWebhook.controller.js` ✅

---

## Despliegue

### 1️⃣ Preparación

```bash
# Estar en rama correcta
git branch

# Agregar cambios
git add .

# Commit
git commit -m "feat: Implementar migración de watchtime desde Botrix

- Detecta patrón @usuario ha pasado X dias Y horas Z min viendo este canal
- Migra watchtime automáticamente a tabla user_watchtime
- Control de duplicados (solo una migración por usuario)
- Configurable para activar/desactivar
- Estadísticas en endpoint /api/kick-admin/config"

# Push
git push origin develop  # o main, según tu flujo
```

### 2️⃣ Aplicar Migración en Staging

```bash
# SSH a servidor staging
ssh user@staging-server

# Navegar al proyecto
cd /path/to/luisardito-shop-backend

# Pull cambios
git pull origin develop

# Ejecutar migraciones
npm run migrate

# Verificar que funcionó
npm run migrate:status
```

### 3️⃣ Testing en Staging

```bash
# Verificar que el servicio está corriendo
curl http://staging.api/api/kick-admin/config

# Debe retornar sin errores con nueva sección:
# "watchtime_migration": { "enabled": true, "stats": { ... } }

# Verificar logs
tail -f /var/log/luisardito/app.log | grep "WATCHTIME"
```

### 4️⃣ Testing Manual en Staging

1. Activar migración (si estaba desactivada)
2. Enviar mensaje de prueba desde bot de test
3. Verificar en logs que se procesó
4. Verificar en BD que se guardó correctamente

```sql
-- En BD de staging
SELECT * FROM usuarios WHERE botrix_watchtime_migrated = true LIMIT 5;
```

### 5️⃣ Despliegue a Producción

```bash
# SSH a servidor producción
ssh user@prod-server

# Backup de BD (antes de todo)
mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME > backups/before-watchtime-$(date +%Y%m%d-%H%M%S).sql

# Navegar al proyecto
cd /path/to/luisardito-shop-backend

# Pull cambios
git pull origin main  # o develop según tu flujo

# Ejecutar migraciones
npm run migrate

# Reiniciar servicio
systemctl restart luisardito-shop-backend

# o si usas PM2
pm2 restart app
```

### 6️⃣ Verificación Post-Despliegue

```bash
# Verificar que el servicio está running
curl http://api.luisardito.com/api/kick-admin/config

# Ver logs
tail -f /var/log/luisardito/app.log | grep "WATCHTIME"

# Verificar BD
SELECT COUNT(*) FROM usuarios WHERE botrix_watchtime_migrated = true;
```

---

## Post-Despliegue

### ✅ Monitoreo (Primeras 24 horas)

```bash
# Buscar errores en logs
grep -i "error.*watchtime" /var/log/luisardito/app.log

# Buscar migraciones completadas
grep "Migración completada" /var/log/luisardito/app.log | wc -l

# Verificar que no hay duplicados
SELECT usuario_id, COUNT(*) as count FROM usuarios 
WHERE botrix_watchtime_migrated = true 
GROUP BY usuario_id HAVING count > 1;
```

### ✅ Validaciones

```bash
# Validar que endpoint funciona
curl -X GET http://api.luisardito.com/api/kick-admin/config \
  -H "Authorization: Bearer $TOKEN" | jq '.watchtime_migration'

# Validar que se puede activar/desactivar
curl -X PUT http://api.luisardito.com/api/kick-admin/watchtime-migration \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"watchtime_migration_enabled": false}'

# Validar que vuelve a activarse
curl -X PUT http://api.luisardito.com/api/kick-admin/watchtime-migration \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"watchtime_migration_enabled": true}'
```

### 📊 Métricas a Monitorear

```sql
-- Usuarios migrados
SELECT COUNT(*) as total_migrados FROM usuarios WHERE botrix_watchtime_migrated = true;

-- Minutos totales migrados
SELECT SUM(botrix_watchtime_minutes_migrated) as total_minutos FROM usuarios WHERE botrix_watchtime_migrated = true;

-- Promedio de minutos por usuario
SELECT AVG(botrix_watchtime_minutes_migrated) as promedio FROM usuarios WHERE botrix_watchtime_migrated = true;

-- Tendencia en tiempo
SELECT 
  DATE(botrix_watchtime_migrated_at) as fecha,
  COUNT(*) as usuarios_migrados
FROM usuarios 
WHERE botrix_watchtime_migrated = true
GROUP BY DATE(botrix_watchtime_migrated_at)
ORDER BY fecha DESC
LIMIT 30;
```

---

## Rollback (Si algo falla)

### Plan de Rollback

```bash
# Si hay problemas graves, hacer rollback

# 1. Revertir el código
git revert HEAD --no-edit
git push origin main

# 2. Revertir migraciones (CUIDADO: perderá datos)
# Hay que hacer esto manualmente:
# - Ejecutar down() en migración

# 3. Restaurar backup de BD
mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME < backup-YYYYMMDD-HHMMSS.sql

# 4. Reiniciar servicio
systemctl restart luisardito-shop-backend
```

---

## Checklist Final

### ✅ Antes de Desplegar

- [ ] Todos los cambios están commitados
- [ ] Se pasaron pruebas en local
- [ ] Se testeó en staging
- [ ] Backup de BD producción está listo
- [ ] Plan de rollback documentado
- [ ] Equipo notificado del cambio
- [ ] Horario de despliegue confirmado
- [ ] Logs monitoreados en tiempo real

### ✅ Después de Desplegar

- [ ] Servicio está running sin errores
- [ ] Endpoint /config funciona correctamente
- [ ] Logs muestran migraciones procesadas
- [ ] BD tiene los datos correctamente guardados
- [ ] Se puede activar/desactivar la migración
- [ ] Usuarios pueden ver su watchtime migrado
- [ ] No hay regresiones en funcionalidad existente
- [ ] Documentación actualizada

---

## Contactos y Escalación

En caso de problemas:

1. **Revisar logs** - Ver archivo de logs del servidor
2. **Consultar documentación** - Ver `WATCHTIME-MIGRATION-IMPLEMENTATION.md`
3. **Verificar BD** - Ejecutar queries de validación
4. **Hacer rollback** si es necesario (ver Plan de Rollback)

---

## Documentación para el Equipo

### Compartir estos archivos:

1. **`GUIA-RAPIDA-WATCHTIME.md`** - Para admins/moderadores
2. **`WATCHTIME-MIGRATION-EJEMPLOS.md`** - Para ejemplos de uso
3. **`RESUMEN-WATCHTIME-MIGRATION.md`** - Para visión general
4. **Este checklist** - Para el equipo de DevOps

---

## Notas Finales

✅ **Estado**: Listo para despliegue
✅ **Riesgo**: Bajo (funcionalidad nueva, no afecta existente)
✅ **Reversibilidad**: Alta (fácil de desactivar desde API)
⚠️ **Datos**: Irreversibles una vez migrados (como diseño)

---

**Checklist creado**: 2026-01-03
**Última actualización**: 2026-01-03
**Estado**: Listo para usar

