# 📬 Sistema de Notificaciones - Guía de Deployment

## 🚀 Pasos para Poner en Producción

### 1. Pre-Deployment

#### a) Verificar que los archivos estén en su lugar
```bash
# Verificar modelo
test -f src/models/notificacion.model.js && echo "✅ Modelo OK"

# Verificar migración
ls migrations/ | grep "create-notificaciones" && echo "✅ Migración OK"

# Verificar servicio
test -f src/services/notificacion.service.js && echo "✅ Servicio OK"

# Verificar controlador
test -f src/controllers/notificaciones.controller.js && echo "✅ Controlador OK"

# Verificar rutas
test -f src/routes/notificaciones.routes.js && echo "✅ Rutas OK"
```

#### b) Verificar imports en app.js
```bash
grep -n "notificacionesRoutes\|/api/notificaciones" app.js
# Debería mostrar 2 líneas
```

#### c) Verificar imports en models/index.js
```bash
grep -n "Notificacion" src/models/index.js
# Debería mostrar 3 líneas (import, asociación, export)
```

### 2. Ejecutar Migración

```bash
# En desarrollo
npm run migrate

# O con sequelize-cli directamente
npx sequelize-cli db:migrate

# Verificar que la tabla se creó
# Para MySQL/MariaDB:
mysql -u usuario -p base_datos -e "DESC notificaciones;"

# Para PostgreSQL:
psql -U usuario base_datos -c "\d notificaciones"
```

### 3. Verificar en Base de Datos

```sql
-- Para MySQL/MariaDB
SHOW TABLES LIKE 'notificaciones';
DESC notificaciones;
SHOW INDEXES FROM notificaciones;

-- Debería mostrar campos y índices creados
```

### 4. Iniciar Servidor

```bash
npm start
# O
npm run dev
```

### 5. Testear Endpoints

```bash
# Test 1: Listar (debería retornar array vacío)
curl -X GET http://localhost:3000/api/notificaciones \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json"

# Respuesta esperada:
# { "total": 0, "page": 1, "limit": 20, "pages": 0, "notificaciones": [] }

# Test 2: Contar no leídas (debería retornar 0)
curl -X GET http://localhost:3000/api/notificaciones/no-leidas/contar \
  -H "Authorization: Bearer <YOUR_TOKEN>"

# Respuesta esperada:
# { "cantidad": 0 }
```

### 6. Crear una Notificación Manual (Para Testing)

Si necesitas crear una notificación de prueba:

```javascript
// En el backend, ejecutar en una terminal Node:
const { Notificacion } = require('./src/models');

await Notificacion.create({
  usuario_id: 1,  // ID del usuario en tu BD
  titulo: "Notificación de Prueba",
  descripcion: "Esta es una notificación de prueba del sistema",
  tipo: "sistema",
  estado: "no_leida",
  datos_relacionados: { test: true },
  enlace_detalle: "/test"
});

console.log("✅ Notificación creada");
```

### 7. Testing End-to-End

#### Test 1: Crear Canje (Debería crear notificación)
```bash
# 1. Crear canje
curl -X POST http://localhost:3000/api/canjes \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"producto_id": 1}'

# 2. Verificar que la notificación se creó
curl -X GET http://localhost:3000/api/notificaciones \
  -H "Authorization: Bearer <USER_TOKEN>"

# 3. Debería ver una notificación de tipo "canje_creado"
```

#### Test 2: Marcar Como Leída
```bash
# Obtener ID de una notificación no leída
# Supongamos que es 1

curl -X PATCH http://localhost:3000/api/notificaciones/1/leido \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json"

# Response debería mostrar estado "leida"
```

#### Test 3: Marcar Todas Como Leídas
```bash
curl -X PATCH http://localhost:3000/api/notificaciones/leer-todas \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json"

# Response debería mostrar cantidad actualizada
```

### 8. Monitoreo Continuo

#### Log Pattern para Búsqueda
En los logs, buscar:
```
📬 [Notificación]  // Creación de notificaciones
✅ [Notificación]  // Operaciones exitosas
❌ [Notificación]  // Errores
```

#### Queries Útiles para Monitoreo
```sql
-- Contar notificaciones por tipo
SELECT tipo, COUNT(*) as cantidad 
FROM notificaciones 
WHERE deleted_at IS NULL 
GROUP BY tipo;

-- Contar no leídas por usuario
SELECT usuario_id, COUNT(*) as no_leidas
FROM notificaciones
WHERE estado = 'no_leida' AND deleted_at IS NULL
GROUP BY usuario_id
ORDER BY no_leidas DESC;

-- Notificaciones recientes
SELECT * FROM notificaciones
ORDER BY fecha_creacion DESC
LIMIT 10;

-- Usuarios con más notificaciones
SELECT usuario_id, COUNT(*) as total
FROM notificaciones
WHERE deleted_at IS NULL
GROUP BY usuario_id
ORDER BY total DESC
LIMIT 5;
```

### 9. Rollback (Si Algo Sale Mal)

```bash
# Revertir la última migración
npx sequelize-cli db:migrate:undo

# Revertir todas las migraciones
npx sequelize-cli db:migrate:undo:all

# Revertir hasta una migración específica
npx sequelize-cli db:migrate:undo --name <nombre-migración>
```

### 10. Escalar a Producción

#### Consideraciones

1. **Base de Datos**
   - [ ] Índices creados correctamente
   - [ ] Backups automáticos configurados
   - [ ] Monitoreo de espacio en disco

2. **Performance**
   - [ ] Paginación por defecto a 20 resultados
   - [ ] Índices en (usuario_id, estado) para queries frecuentes
   - [ ] Soft deletes para no perder datos

3. **Seguridad**
   - [ ] Todas las rutas requieren autenticación
   - [ ] Validación de usuario propietario
   - [ ] CORS configurado correctamente

4. **Logging**
   - [ ] Logs centralizados
   - [ ] Alertas para errores
   - [ ] Métricas de uso

5. **Carga**
   - [ ] Plan de escalado para storage
   - [ ] Limpieza de notificaciones antiguas (opcional)
   - [ ] Caché en Redis (opcional)

### 11. Optimizaciones Opcionales (Post-Launch)

#### a) Agregar Redis para Caché de Contador
```javascript
// En notificacion.service.js
static async contarNoLeidas(usuarioId) {
  const redis = getRedisClient();
  const cacheKey = `notificaciones:no_leidas:${usuarioId}`;
  
  // Intentar obtener del caché
  const cached = await redis.get(cacheKey);
  if (cached !== null) return { cantidad: parseInt(cached) };
  
  // Si no está en caché, consultar BD
  const cantidad = await Notificacion.count({
    where: { usuario_id: usuarioId, estado: 'no_leida', deleted_at: null }
  });
  
  // Guardar en caché por 5 minutos
  await redis.setex(cacheKey, 300, cantidad);
  
  return { cantidad };
}
```

#### b) Agregar Limpieza Automática de Notificaciones Antiguas
```javascript
// En src/services/notificacionCleanup.task.js
class NotificacionCleanupTask {
  static start() {
    // Ejecutar diariamente a las 3 AM
    schedule.scheduleJob('0 3 * * *', async () => {
      try {
        // Eliminar soft notificaciones más de 90 días
        const fecha90DiasAtras = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const result = await Notificacion.destroy({
          where: {
            deleted_at: { [Op.lt]: fecha90DiasAtras }
          }
        });
        logger.info(`🧹 [Limpieza] ${result} notificaciones antiguas eliminadas`);
      } catch (error) {
        logger.error(`❌ [Limpieza] Error: ${error.message}`);
      }
    });
  }
}
```

### 12. Checklist Final

- [ ] Migración ejecutada exitosamente
- [ ] Tabla `notificaciones` creada en BD
- [ ] Índices creados
- [ ] App.js registra rutas
- [ ] models/index.js importa y asocia modelo
- [ ] Endpoints responden con autenticación
- [ ] Notificaciones se crean al hacer canjes
- [ ] Notificaciones se crean en webhook de Kick
- [ ] Paginación funciona correctamente
- [ ] Soft deletes funcionan
- [ ] Logs muestran operaciones correctamente
- [ ] Testing end-to-end completado
- [ ] Documentación actualizada
- [ ] Equipo de frontend notificado

## 🎯 Próximos Pasos (Frontend)

1. **Ver SISTEMA-NOTIFICACIONES-EJEMPLOS.md** para ejemplos React
2. **Crear componente de NotificationCenter** en el frontend
3. **Agregar badge de notificaciones** en el header
4. **Implementar click handlers** para navegar a detalles
5. **(Opcional) Agregar WebSockets** para notificaciones en tiempo real

## 📞 Soporte

Si encuentras problemas:

1. Revisar logs: `npm start 2>&1 | grep -i "notificacion\|error"`
2. Verificar BD: `SELECT * FROM notificaciones LIMIT 1;`
3. Revisar modelo: `src/models/notificacion.model.js`
4. Revisar servicio: `src/services/notificacion.service.js`

## 🎉 ¡Felicidades!

El sistema de notificaciones está completamente implementado y listo para usar.

