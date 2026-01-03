# 🚀 Sistema de Notificaciones - Checklist de Producción

## ✅ Tu Infraestructura Actual

```
luisardito-shop-backend-api     → Puerto 3001 (contenedor 3000)
luisardito-shop-frontend        → Puerto 3002 (contenedor 3000)
luisardito-mysql                → Puerto 3307 (contenedor 3306)
luisardito-redis                → Puerto 6379
```

---

## 🔧 PASO 1: Verificar que la Migración se Aplicó

### Conectarse a la BD MySQL en producción:

```bash
# Desde el VPS
mysql -h 127.0.0.1 -P 3307 -u root -p luisardito_shop
```

O si tienes alias:
```bash
docker exec -it luisardito-mysql mysql -u root -p luisardito_shop
```

### Verificar que la tabla existe:

```sql
-- Dentro de MySQL
SHOW TABLES LIKE 'notificaciones';

-- Debería mostrar:
-- | Tables_in_luisardito_shop (notificaciones) |
-- | notificaciones                             |
```

Si **NO** aparece, ejecuta:
```bash
docker exec -it luisardito-backend npm run migrate
```

---

## 🔍 PASO 2: Verificar la Estructura de la Tabla

```sql
DESC notificaciones;
```

Debería mostrar estos campos:
```
| id                   | int(11)     | PRIMARY KEY AUTO_INCREMENT |
| usuario_id           | int(11)     | NOT NULL (FK usuarios)     |
| titulo               | varchar(255)| NOT NULL                   |
| descripcion          | text        | NOT NULL                   |
| tipo                 | enum(...)   | NOT NULL                   |
| estado               | enum(...)   | NOT NULL                   |
| datos_relacionados   | json        | NULL                       |
| enlace_detalle       | varchar(500)| NULL                       |
| fecha_lectura        | datetime    | NULL                       |
| deleted_at           | datetime    | NULL                       |
| fecha_creacion       | datetime    | NOT NULL                   |
| fecha_actualizacion  | datetime    | NOT NULL                   |
```

---

## 📊 PASO 3: Verificar los Índices

```sql
SHOW INDEXES FROM notificaciones;
```

Debería mostrar estos índices:
```
idx_notificaciones_usuario_id
idx_notificaciones_estado
idx_notificaciones_tipo
idx_notificaciones_usuario_estado
idx_notificaciones_fecha_creacion
```

---

## ✅ PASO 4: Testear los Endpoints en Producción

### Obtener un token válido primero:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tu@email.com","password":"tupassword"}'
```

Copia el token del response.

### Testear endpoint de listar:
```bash
curl -X GET 'http://localhost:3001/api/notificaciones?page=1&limit=20' \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

Debería retornar:
```json
{
  "total": 0,
  "page": 1,
  "limit": 20,
  "pages": 0,
  "notificaciones": []
}
```

### Testear endpoint de contar no leídas:
```bash
curl -X GET 'http://localhost:3001/api/notificaciones/no-leidas/contar' \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

Debería retornar:
```json
{"cantidad": 0}
```

### Testear endpoint PATCH (ahora que agregamos PATCH a CORS):
```bash
curl -X PATCH 'http://localhost:3001/api/notificaciones/leer-todas' \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -H "Content-Type: application/json"
```

Debería retornar:
```json
{
  "mensaje": "Todas las notificaciones marcadas como leídas",
  "cantidad_actualizadas": 0
}
```

---

## 🐳 PASO 5: Reconstruir y Redeploy (IMPORTANTE)

Después de hacer cambios en el backend, **debe recompilar la imagen Docker**:

```bash
# Desde la carpeta del backend en el VPS
cd ~/apps/luisardito-shop-backend

# Detener el contenedor
docker-compose down

# Reconstruir la imagen
docker-compose build

# Iniciar nuevamente
docker-compose up -d
```

O si usas la imagen pre-compilada:
```bash
# Detener
docker stop luisardito-backend

# Remover
docker rm luisardito-backend

# Recrear (se recarga automáticamente)
docker run -d --name luisardito-backend ...
```

---

## ✅ PASO 6: Verificar Logs en Producción

```bash
# Ver logs del backend
docker logs -f luisardito-backend

# Debería mostrar:
# ✅ Base de datos conectada y modelos sincronizados
# ✅ Sin errores de "Notificacion is not defined"
# ✅ Sin errores de rutas
```

---

## 🔗 PASO 7: Verificar que Frontend Está Conectando al Puerto Correcto

En producción, el frontend debe conectar a:
```
http://localhost:3001  (desde el navegador del VPS)
O
https://tu-dominio.com/api  (desde producción real)
```

En el contenedor frontend (`luisardito-shop-frontend`), verificar que `lib/api.ts` tiene:
```javascript
baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001'
```

---

## 📋 Checklist Final

- [ ] Tabla `notificaciones` existe en MySQL
- [ ] Estructura y campos son correctos
- [ ] Índices están creados
- [ ] GET /api/notificaciones funciona (retorna JSON válido)
- [ ] GET /api/notificaciones/no-leidas/contar funciona
- [ ] PATCH /api/notificaciones/leer-todas funciona (sin error CORS)
- [ ] Logs del backend sin errores
- [ ] Frontend conecta a puerto 3001 (no 3000)
- [ ] CORS permite método PATCH (verificado en cors.middleware.js)

---

## 🆘 Troubleshooting

### Error: "Table 'notificaciones' doesn't exist"
```bash
docker exec -it luisardito-backend npm run migrate
```

### Error: "CORS blocked PATCH method"
→ ✅ YA CORREGIDO en `src/middleware/cors.middleware.js`
→ Necesitas reconstruir la imagen Docker

### Error: "notificacionesRoutes is not defined"
→ ✅ YA CORREGIDO en `app.js` línea 32
→ Necesitas reconstruir la imagen Docker

### El frontend aún intenta conectar a puerto 3001
Pero en local usa 3000. Revisa la configuración de axios en el frontend.

---

## 🎯 Comando Rápido para Verificar TODO

```bash
# Acceder a MySQL
docker exec -it luisardito-mysql mysql -u root -p luisardito_shop -e "SHOW TABLES LIKE 'notificaciones'; DESC notificaciones; SHOW INDEXES FROM notificaciones;"

# Ver logs del backend
docker logs luisardito-backend | grep -E "✅|❌|Error|Notificacion"

# Testear endpoint
curl -X GET http://localhost:3001/api/notificaciones \
  -H "Authorization: Bearer $(curl -s -X POST http://localhost:3001/api/auth/login -d '{}' | jq -r '.token')"
```

---

## ✨ Resumen

**Lo que hiciste bien:**
✅ Sistema de notificaciones completamente implementado
✅ Modelos, servicios, controladores y rutas creadas
✅ Integraciones en canjes y webhooks
✅ Documentación exhaustiva

**Lo que debes verificar en producción:**
1. Migración se aplicó (tabla existe)
2. Estructura es correcta
3. Endpoints responden correctamente
4. CORS está actualizado (PATCH agregado)
5. Frontend conecta al puerto correcto (3001)

**Después de verificar, el sistema estará 100% funcional en producción.** 🚀

