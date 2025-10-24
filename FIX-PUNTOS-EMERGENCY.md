# 🚨 FIX EMERGENCIA: Error "Unknown column 'puntos'"

## Problema
El backend está generando el error:
```
[Kick Webhook][Chat Message] Error: Unknown column 'puntos' in 'field list'
```

Y el frontend recibe un error 500 al consultar:
```
GET http://localhost:3001/api/historial-puntos/3 500 (Internal Server Error)
```

## Causa
La tabla `usuarios` en la base de datos no tiene la columna `puntos`, lo que indica que las migraciones no se ejecutaron correctamente.

## Solución Inmediata

### En el servidor de producción:

1. **Conectarse al servidor:**
```bash
ssh naferj@vps-4556ad01
cd ~/apps/luisardito-shop-backend
```

2. **Ejecutar la migración de emergencia:**
```bash
# Opción 1: Usar el script de emergencia
./emergency-rollback.sh fix-puntos

# Opción 2: Ejecutar directamente
npx sequelize-cli db:migrate --to 20251024000001-emergency-add-puntos-column.js
```

3. **Verificar que se aplicó correctamente:**
```bash
./emergency-rollback.sh status
```

4. **Reiniciar el contenedor del backend:**
```bash
docker restart luisardito-backend
```

### Desde Windows (si tienes acceso directo a la BD):

```powershell
.\emergency-rollback.ps1 fix-puntos
```

## Qué hace la migración de emergencia

La migración `20251024000001-emergency-add-puntos-column.js`:

1. Verifica si la columna `puntos` existe en la tabla `usuarios`
2. Si no existe, la crea con:
   - Tipo: INTEGER
   - Valor por defecto: 0
   - No nulo
3. Verifica que la tabla `historial_puntos` existe y tiene la columna `puntos`
4. Registra todo el proceso en la consola

## Verificación Post-Fix

Después de aplicar la migración, verificar:

1. **Revisar logs del backend:**
```bash
docker logs --tail 50 luisardito-backend
```

2. **Probar el endpoint desde el frontend:**
   - El error 500 debería desaparecer
   - Los webhooks de Kick deberían funcionar sin errores

3. **Verificar estructura de BD:**
```sql
DESCRIBE usuarios;
DESCRIBE historial_puntos;
```

## Prevención

Para evitar este problema en el futuro:

1. Siempre ejecutar migraciones en producción después de deploy
2. Verificar que todas las migraciones estén en `SequelizeMeta`
3. Usar scripts de rollback antes de aplicar cambios grandes

## Archivos creados/modificados

- `migrations/20251024000001-emergency-add-puntos-column.js` - Migración de emergencia
- `emergency-rollback.sh` - Script actualizado con opción fix-puntos
- `emergency-rollback.ps1` - Versión PowerShell del script
- `FIX-PUNTOS-EMERGENCY.md` - Este documento
