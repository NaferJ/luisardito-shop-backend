# ✅ Checklist de Deployment - Sistema de Leaderboard

## 📋 Pre-Deployment

### Backend

- [ ] **Código revisado y testeado localmente**
  - [ ] Todos los archivos creados están presentes
  - [ ] No hay errores de sintaxis (ejecutar `npm run lint` si aplica)
  - [ ] Script de prueba ejecutado exitosamente: `node test-leaderboard.js`

- [ ] **Migración de base de datos lista**
  - [ ] Archivo de migración existe: `migrations/20250128000001-create-leaderboard-snapshots.js`
  - [ ] Migración probada en entorno local/dev
  - [ ] Backup de base de datos creado (recomendado)

- [ ] **Variables de entorno configuradas**
  - [ ] `LEADERBOARD_SNAPSHOT_INTERVAL_HOURS` definida (default: 6)
  - [ ] `LEADERBOARD_CLEANUP_DAYS` definida (default: 30)
  - [ ] Variables documentadas en `.env.example`

- [ ] **Dependencias verificadas**
  - [ ] `sequelize` instalado
  - [ ] Todas las dependencias actualizadas: `npm install`
  - [ ] No hay vulnerabilidades críticas: `npm audit`

---

## 🚀 Deployment Steps

### Paso 1: Preparar el Entorno

**Producción:**
```bash
# 1. Conectar al servidor
ssh user@your-server.com

# 2. Navegar al proyecto
cd /path/to/luisardito-shop-backend

# 3. Cambiar a la rama correcta
git checkout main
git pull origin main
```

**Docker:**
```bash
# 1. Detener servicios
docker-compose down

# 2. Actualizar código
git pull origin main

# 3. Reconstruir si es necesario
docker-compose build backend
```

- [ ] Código actualizado en el servidor
- [ ] Rama correcta desplegada

---

### Paso 2: Ejecutar Migración

**Importante:** Crear backup antes de ejecutar la migración.

**Con Docker:**
```bash
# Backup (opcional pero recomendado)
docker-compose exec db pg_dump -U postgres luisardito_shop > backup_pre_leaderboard.sql

# Ejecutar migración
docker-compose exec backend npx sequelize-cli db:migrate

# Verificar que se creó la tabla
docker-compose exec db psql -U postgres -d luisardito_shop -c "\dt leaderboard_snapshots"
```

**Sin Docker:**
```bash
# Backup
pg_dump -U your_user luisardito_shop > backup_pre_leaderboard.sql

# Ejecutar migración
npx sequelize-cli db:migrate

# Verificar tabla
psql -U your_user -d luisardito_shop -c "\dt leaderboard_snapshots"
```

- [ ] Backup de base de datos creado
- [ ] Migración ejecutada sin errores
- [ ] Tabla `leaderboard_snapshots` creada
- [ ] Índices creados correctamente

---

### Paso 3: Configurar Variables de Entorno

Editar `.env` en producción:

```bash
# Leaderboard Configuration
LEADERBOARD_SNAPSHOT_INTERVAL_HOURS=6
LEADERBOARD_CLEANUP_DAYS=30
```

**Valores recomendados por entorno:**

- **Producción:** `6` horas, `30` días
- **Staging:** `3` horas, `14` días
- **Development:** `1` hora, `7` días

- [ ] Variables agregadas al `.env`
- [ ] Valores apropiados para el entorno

---

### Paso 4: Reiniciar Servicios

**Con Docker:**
```bash
docker-compose up -d backend
```

**Con PM2:**
```bash
pm2 restart backend
```

**Sin gestores de procesos:**
```bash
npm start
```

- [ ] Servicios reiniciados correctamente

---

### Paso 5: Verificar Deployment

#### 5.1 Revisar Logs

```bash
# Docker
docker-compose logs -f backend | grep LEADERBOARD

# PM2
pm2 logs backend | grep LEADERBOARD

# Directo
tail -f logs/app.log | grep LEADERBOARD
```

**Buscar estas líneas:**
```
🚀 [LEADERBOARD-SNAPSHOT] Iniciando tarea programada (cada X horas)
📸 [LEADERBOARD-SNAPSHOT] Iniciando snapshot del leaderboard...
✅ [LEADERBOARD-SNAPSHOT] Snapshot creado: X usuarios registrados
```

- [ ] Logs muestran inicio correcto del servicio
- [ ] Snapshot inicial creado sin errores

#### 5.2 Test de Endpoints

```bash
# Base URL del servidor
BASE_URL="https://your-domain.com"

# Test 1: Health check
curl $BASE_URL/health

# Test 2: Top 10
curl $BASE_URL/api/leaderboard/top10

# Test 3: Estadísticas
curl $BASE_URL/api/leaderboard/stats

# Test 4: Leaderboard completo
curl "$BASE_URL/api/leaderboard?limit=20"
```

**Respuestas esperadas:**
- Status 200 OK
- JSON con estructura correcta
- Datos de usuarios presentes

- [ ] Endpoint `/api/leaderboard/top10` funciona
- [ ] Endpoint `/api/leaderboard/stats` funciona
- [ ] Endpoint `/api/leaderboard` funciona
- [ ] Datos se retornan correctamente

#### 5.3 Crear Snapshot Manual (Opcional)

```bash
# Obtener token de admin
TOKEN="your-admin-jwt-token"

# Crear snapshot
curl -X POST $BASE_URL/api/leaderboard/snapshot \
  -H "Authorization: Bearer $TOKEN"
```

- [ ] Snapshot manual creado exitosamente

---

## 🔍 Post-Deployment Monitoring

### Primeras 24 Horas

- [ ] **Verificar snapshots automáticos**
  - Revisar logs cada 6 horas (o según configuración)
  - Confirmar que se crean snapshots correctamente

- [ ] **Monitorear uso de base de datos**
  ```sql
  -- Contar registros en la tabla
  SELECT COUNT(*) FROM leaderboard_snapshots;
  
  -- Ver tamaño de la tabla
  SELECT pg_size_pretty(pg_total_relation_size('leaderboard_snapshots'));
  ```

- [ ] **Revisar métricas de rendimiento**
  - Tiempo de respuesta de endpoints (debe ser < 100ms)
  - Carga del servidor durante creación de snapshots
  - Uso de CPU y memoria

- [ ] **Probar desde el frontend**
  - Acceder a la página de leaderboard
  - Verificar que se muestran usuarios
  - Confirmar que aparecen indicadores de cambio

---

## 📊 Validación de Datos

### Verificar Integridad de Datos

```sql
-- Ver últimos snapshots creados
SELECT 
  DATE_TRUNC('hour', snapshot_date) as hora,
  COUNT(*) as usuarios
FROM leaderboard_snapshots
GROUP BY DATE_TRUNC('hour', snapshot_date)
ORDER BY hora DESC
LIMIT 10;

-- Ver usuarios con más cambios de posición
SELECT 
  usuario_id,
  COUNT(*) as snapshots_registrados
FROM leaderboard_snapshots
GROUP BY usuario_id
ORDER BY snapshots_registrados DESC
LIMIT 10;

-- Verificar índices
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'leaderboard_snapshots';
```

- [ ] Snapshots se están creando periódicamente
- [ ] Datos lucen coherentes
- [ ] Índices están presentes

---

## 🐛 Troubleshooting

### Problema: Los snapshots no se crean automáticamente

**Diagnóstico:**
```bash
# Verificar logs
docker-compose logs backend | grep LEADERBOARD-SNAPSHOT

# Verificar configuración
docker-compose exec backend env | grep LEADERBOARD
```

**Solución:**
1. Verificar que `LeaderboardSnapshotTask.start()` se llama en `app.js`
2. Revisar variables de entorno
3. Reiniciar el servicio

---

### Problema: Endpoints retornan 500

**Diagnóstico:**
```bash
# Ver error específico
docker-compose logs backend | tail -50
```

**Soluciones comunes:**
1. Verificar que la migración se ejecutó
2. Confirmar que la tabla existe
3. Revisar permisos de base de datos

---

### Problema: Indicadores siempre muestran "new"

**Causa:** No hay snapshots previos para comparar.

**Solución:**
1. Esperar al siguiente snapshot automático, o
2. Crear uno manualmente (ver sección 5.3)

---

## 🔒 Seguridad

- [ ] **Endpoints admin protegidos**
  - `/api/leaderboard/snapshot` requiere autenticación
  - `/api/leaderboard/snapshots/old` requiere autenticación
  - Verificar que permisos funcionan correctamente

- [ ] **Rate limiting configurado (si aplica)**
  ```javascript
  // Ejemplo con express-rate-limit
  const rateLimit = require('express-rate-limit');
  
  const leaderboardLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 60 // 60 requests por minuto
  });
  
  app.use('/api/leaderboard', leaderboardLimiter);
  ```

- [ ] **CORS configurado apropiadamente**
  - Solo dominios autorizados pueden acceder
  - Headers de seguridad presentes

---

## 📈 Optimizaciones Post-Deployment

### Semana 1

- [ ] Monitorear tamaño de la tabla `leaderboard_snapshots`
- [ ] Ajustar `LEADERBOARD_CLEANUP_DAYS` si es necesario
- [ ] Revisar feedback de usuarios del frontend

### Semana 2-4

- [ ] Analizar métricas de uso
  - ¿Qué endpoints son más usados?
  - ¿Cuál es el tiempo de respuesta promedio?
- [ ] Considerar caché en Redis para top 10
- [ ] Evaluar necesidad de CDN para assets estáticos

---

## 📝 Documentación

- [ ] **README actualizado**
  - Mencionar nueva funcionalidad de leaderboard
  - Agregar link a documentación

- [ ] **API Documentation actualizada**
  - Nuevos endpoints documentados
  - Ejemplos de uso agregados

- [ ] **Changelog actualizado**
  ```markdown
  ## [1.X.0] - 2025-01-28
  ### Added
  - Sistema completo de leaderboard con indicadores de cambio de posición
  - 7 nuevos endpoints para consulta de rankings
  - Snapshots automáticos cada 6 horas
  - Limpieza automática de datos antiguos
  ```

---

## 🎯 Rollback Plan

En caso de problemas críticos:

### Paso 1: Detener el Servicio
```bash
docker-compose down backend
# o
pm2 stop backend
```

### Paso 2: Revertir Migración
```bash
# Rollback de la última migración
npx sequelize-cli db:migrate:undo

# O restaurar desde backup
psql -U postgres luisardito_shop < backup_pre_leaderboard.sql
```

### Paso 3: Revertir Código
```bash
git revert <commit-hash>
# o
git reset --hard HEAD~1
```

### Paso 4: Reiniciar Servicios
```bash
docker-compose up -d
# o
pm2 restart backend
```

- [ ] Plan de rollback documentado y entendido
- [ ] Backup disponible para restauración rápida

---

## ✅ Deployment Completado

Una vez que todos los checks estén marcados:

- [ ] **Sistema funcionando correctamente**
- [ ] **Endpoints respondiendo sin errores**
- [ ] **Snapshots creándose automáticamente**
- [ ] **Frontend integrado y probado**
- [ ] **Equipo notificado del nuevo feature**
- [ ] **Documentación accesible para desarrolladores**

---

## 📞 Contactos de Emergencia

**En caso de problemas críticos:**

- **DevOps:** [contacto]
- **Backend Lead:** [contacto]
- **Database Admin:** [contacto]

---

## 📚 Referencias Útiles

- `LEADERBOARD-SYSTEM.md` - Documentación técnica completa
- `LEADERBOARD-QUICKSTART.md` - Guía de inicio rápido
- `LEADERBOARD-FRONTEND-EXAMPLES.md` - Ejemplos de integración
- `test-leaderboard.js` - Script de testing

---

**Fecha de Deployment:** _____________  
**Responsable:** _____________  
**Versión:** 1.0.0  
**Estado:** [ ] Completado

---

**¡Deployment exitoso! 🚀🏆**