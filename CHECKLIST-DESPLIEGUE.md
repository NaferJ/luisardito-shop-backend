# 📋 Checklist de Despliegue - Max Points y Watchtime

**Generado:** 2026-01-04T04:09:45.652Z
**Total de pasos:** 26


## 1. 🔍 Verificación Pre-Despliegue

- [ ] **Verificar que el servidor está pausado**
  - `docker ps | grep luisardito-backend`
  - Si ves el contenedor corriendo, detenerlo primero

- [ ] **Verificar conexión a base de datos**
  - `docker-compose ps db`
  - La BD debe estar corriendo (estado: Up)

- [ ] **Verificar Redis está disponible**
  - `docker-compose ps | grep redis`
  - Redis debe estar en estado Up

- [ ] **Ejecutar script de verificación**
  - `node verify-implementation.js`
  - Debe mostrar ✅ Verificación completada


## 2. 💾 Aplicar Migraciones

- [ ] **Opción A: Usar Sequelize CLI (recomendado)**
  - `npm run migrate`
  - Esto aplica TODAS las migraciones pendientes

- [ ] **O Opción B: Script SQL directo**
  - `docker-compose exec db mysql -u app -papp luisardito_shop < migrations/manual-apply-max-puntos-watchtime.sql`
  - Si la opción A falla, usar esta

- [ ] **Verificar que las migraciones se aplicaron**
  - `docker-compose exec db mysql -u app -papp -e "DESC usuarios;" luisardito_shop | grep max_puntos`
  - Debe devolver una fila con 'max_puntos'

- [ ] **Verificar tabla user_watchtime**
  - `docker-compose exec db mysql -u app -papp -e "DESC user_watchtime;" luisardito_shop`
  - Debe mostrar la estructura de la tabla


## 3. 📝 Inicializar Datos

- [ ] **Ejecutar script de inicialización**
  - `node initialize-watchtime.js`
  - Crea registros de watchtime para usuarios existentes

- [ ] **Verificar que se crearon registros**
  - `docker-compose exec db mysql -u app -papp -e "SELECT COUNT(*) FROM user_watchtime;" luisardito_shop`
  - Debe mostrar el número de registros creados

- [ ] **Verificar max_puntos fue actualizado**
  - `docker-compose exec db mysql -u app -papp -e "SELECT COUNT(*) FROM usuarios WHERE max_puntos > 0;" luisardito_shop`
  - Debe mostrar el número de usuarios con max_puntos


## 4. 🚀 Desplegar Servidor

- [ ] **Reconstruir imágenes (si es necesario)**
  - `docker-compose build luisardito-backend`
  - Solo necesario si actualizaste Dockerfile

- [ ] **Iniciar servidor**
  - `docker-compose up -d luisardito-backend`
  - Inicia el contenedor en background

- [ ] **Esperar a que se inicie correctamente**
  - `sleep 5 && docker-compose logs --tail 20 luisardito-backend`
  - Debe mostrar logs de inicio sin errores


## 5. 🧪 Pruebas de Funcionalidad

- [ ] **Verificar que la API responde**
  - `curl http://localhost:3000/api/leaderboard?limit=1`
  - Debe devolver status 200 con datos del leaderboard

- [ ] **Verificar que max_puntos está en respuesta**
  - `curl http://localhost:3000/api/leaderboard?limit=1 | jq '.data[0].max_puntos'`
  - Debe devolver un número (no null)

- [ ] **Verificar que watchtime_minutes está en respuesta**
  - `curl http://localhost:3000/api/leaderboard?limit=1 | jq '.data[0].watchtime_minutes'`
  - Debe devolver un número (no null)

- [ ] **Enviar mensaje de prueba en Kick**
  - `# Manualmente enviar un mensaje en el chat de Kick como usuario registrado`
  - Esperar 10 segundos para que el webhook procese

- [ ] **Verificar logs de max_puntos**
  - `docker-compose logs --tail 50 luisardito-backend | grep "[MAX POINTS]"`
  - Debe mostrar al menos un log si se actualizó max_puntos

- [ ] **Verificar logs de watchtime**
  - `docker-compose logs --tail 50 luisardito-backend | grep "[WATCHTIME]"`
  - Debe mostrar al menos un log de watchtime

- [ ] **Enviar segundo mensaje después de 5 minutos**
  - `# Esperar 5 minutos y enviar otro mensaje`
  - Verifica que el cooldown funciona correctamente

- [ ] **Verificar en BD que se actualizó**
  - `docker-compose exec db mysql -u app -papp -e "SELECT puntos, max_puntos FROM usuarios WHERE id = 3;" luisardito_shop`
  - Debe mostrar valores actualizados


## 6. ✅ Validación Final

- [ ] **Revisar logs sin errores**
  - `docker-compose logs luisardito-backend | grep "ERROR" || echo 'Sin errores'`
  - No debe haber errores críticos

- [ ] **Verificar que el servidor está healthy**
  - `curl http://localhost:3000/api/leaderboard`
  - Status debe ser 200 y success: true

- [ ] **Ejecutar verificación final**
  - `node verify-implementation.js`
  - Debe mostrar ✅ verificación completada

- [ ] **Documentar estado en logs**
  - `echo 'Max Points y Watchtime desplegados exitosamente - $(date)' >> deployment.log`
  - Mantener registro del despliegue

