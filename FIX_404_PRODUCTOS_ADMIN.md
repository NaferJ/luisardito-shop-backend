# 🐛 FIX: Error 404 en /api/productos/admin

## 📅 Fecha: 2025-11-03
## 🎯 Problema: Ruta `/api/productos/admin` retorna 404

---

## 🔍 DIAGNÓSTICO

### Error Reportado:
```
GET http://localhost:3001/api/productos/admin 404 (Not Found)
```

### Causa Raíz:
**Orden incorrecto de rutas en Express**

Express procesa las rutas en el orden en que se definen. Si defines:
```javascript
router.get('/:id', ...)     // ← Esta captura TODO (incluyendo "admin")
router.get('/admin', ...)   // ← Esta NUNCA se alcanza
```

Cuando haces `GET /admin`, Express:
1. Ve la primera ruta `/:id`
2. Piensa que "admin" es un ID
3. Ejecuta `productosCtrl.obtener` con `req.params.id = "admin"`
4. Nunca llega a la ruta `/admin`

---

## ✅ SOLUCIÓN APLICADA

### Reordenamiento de Rutas en `productos.routes.js`

**❌ ANTES (Incorrecto):**
```javascript
router.get('/', productosCtrl.listar);
router.get('/debug/all', productosCtrl.debugListar);
router.get('/:id', productosCtrl.obtener);           // ← Captura "admin"
router.get('/slug/:slug', auth, ...);
router.get('/admin', authRequired, ...);             // ← NUNCA SE ALCANZA
```

**✅ AHORA (Correcto):**
```javascript
// 1. Ruta raíz
router.get('/', productosCtrl.listar);

// 2. Rutas específicas (ANTES de rutas con parámetros)
router.get('/debug/all', productosCtrl.debugListar);
router.get('/admin', authRequired, permiso('gestionar_canjes'), ...);
router.get('/slug/:slug', auth, ...);

// 3. Rutas con parámetros dinámicos (AL FINAL)
router.get('/:id', productosCtrl.obtener);

// 4. Rutas de modificación
router.post('/', authRequired, ...);
router.put('/:id', authRequired, ...);
router.delete('/:id', authRequired, ...);
```

---

## 📊 ORDEN CORRECTO DE RUTAS EN EXPRESS

### Regla General:
```
1. Rutas exactas (sin parámetros)
   ├─ /
   ├─ /admin
   ├─ /debug/all
   └─ /slug/:slug (con parámetro pero prefijo específico)

2. Rutas con parámetros dinámicos (capturan todo)
   └─ /:id
```

### ⚠️ Importante:
- **Rutas específicas SIEMPRE antes de rutas dinámicas**
- Express **NO** reordena automáticamente
- El primer match gana

---

## 🧪 TESTING

### Probar que funciona:

```bash
# Backend debe estar corriendo
npm run dev

# Test 1: Ruta pública
curl http://localhost:3001/api/productos
# Esperado: 200 OK con lista de productos

# Test 2: Ruta admin (SIN token)
curl http://localhost:3001/api/productos/admin
# Esperado: 401 TOKEN_MISSING (NO 404)

# Test 3: Ruta admin (CON token admin)
curl http://localhost:3001/api/productos/admin \
  -H "Cookie: auth_token=TU_TOKEN_ADMIN"
# Esperado: 200 OK con productos admin

# Test 4: Ruta por ID
curl http://localhost:3001/api/productos/1
# Esperado: 200 OK con producto ID 1

# Test 5: Debug
curl http://localhost:3001/api/productos/debug/all
# Esperado: 200 OK con todos los productos (sin filtros)
```

---

## 📝 ORDEN FINAL DE RUTAS

### Estructura Correcta:
```javascript
const router = require('express').Router();
const productosCtrl = require('../controllers/productos.controller');
const auth = require('../middleware/auth.middleware');
const authRequired = require('../middleware/authRequired.middleware');
const permiso = require('../middleware/permisos.middleware');

// ═══════════════════════════════════════════════════════════
// PÚBLICAS (Sin autenticación)
// ═══════════════════════════════════════════════════════════
router.get('/', productosCtrl.listar);

// ═══════════════════════════════════════════════════════════
// ESPECÍFICAS (Deben ir ANTES de /:id)
// ═══════════════════════════════════════════════════════════
router.get('/debug/all', productosCtrl.debugListar);
router.get('/admin', authRequired, permiso('gestionar_canjes'), productosCtrl.listarAdmin);
router.get('/slug/:slug', auth, productosCtrl.obtenerPorSlug);

// ═══════════════════════════════════════════════════════════
// DINÁMICAS (Con parámetros - Deben ir AL FINAL)
// ═══════════════════════════════════════════════════════════
router.get('/:id', productosCtrl.obtener);

// ═══════════════════════════════════════════════════════════
// MODIFICACIÓN (POST, PUT, DELETE)
// ═══════════════════════════════════════════════════════════
router.post('/', authRequired, permiso('crear_producto'), productosCtrl.crear);
router.put('/:id', authRequired, permiso('editar_producto'), productosCtrl.editar);
router.delete('/:id', authRequired, permiso('eliminar_producto'), productosCtrl.eliminar);

module.exports = router;
```

---

## 🎓 LECCIÓN APRENDIDA

### Para Futuras Rutas:

**✅ Correcto:**
```javascript
router.get('/special', ...)
router.get('/:id', ...)
```

**❌ Incorrecto:**
```javascript
router.get('/:id', ...)
router.get('/special', ...)  // ← Nunca se alcanzará
```

### Checklist al Agregar Rutas:
- [ ] ¿La ruta tiene una parte específica (`/admin`, `/debug`, etc.)?
  - → Ponerla ANTES de rutas con `/:id`
- [ ] ¿La ruta solo tiene parámetros dinámicos (`/:id`, `/:slug`)?
  - → Ponerla AL FINAL
- [ ] ¿Hay otras rutas similares?
  - → Verificar el orden completo

---

## ✅ RESULTADO

### Antes:
```
GET /api/productos/admin
  ↓
Express ve /:id primero
  ↓
Trata "admin" como ID
  ↓
productosCtrl.obtener({ id: "admin" })
  ↓
Busca producto con ID "admin"
  ↓
No existe → 404 ❌
```

### Ahora:
```
GET /api/productos/admin
  ↓
Express ve /admin primero
  ↓
Ejecuta ruta /admin
  ↓
authRequired valida token
  ↓
permiso() valida permisos
  ↓
productosCtrl.listarAdmin()
  ↓
Retorna productos admin → 200 ✅
```

---

## 🔍 OTROS WARNINGS (No críticos)

### Warning de Next.js HMR:
```
TypeError: Cannot read properties of undefined (reading 'components')
at handleStaticIndicator
```

**Causa:** Hot Module Replacement de Next.js en desarrollo  
**Impacto:** Ninguno, solo visual en consola  
**Solución:** No requiere acción, es normal en desarrollo

---

## ✅ CHECKLIST DE VERIFICACIÓN

- [x] ✅ Rutas reordenadas en `productos.routes.js`
- [x] ✅ Sin errores de compilación
- [ ] ⏳ Probar endpoint `/api/productos/admin` (TÚ)
- [ ] ⏳ Verificar que retorna 401 sin token
- [ ] ⏳ Verificar que retorna 200 con token admin
- [ ] ⏳ Verificar que `/:id` sigue funcionando

---

## 🚀 PRÓXIMOS PASOS

1. **Reiniciar el backend** (si está corriendo)
   ```bash
   # Ctrl+C para detener
   npm run dev  # Arrancar de nuevo
   ```

2. **Recargar el frontend**
   ```bash
   # En el navegador
   Ctrl+R o F5
   ```

3. **Probar el endpoint**
   - Ir a la página que usa `/api/productos/admin`
   - Verificar que NO da 404
   - Debería dar 401 si no tienes token
   - O 200 si tienes token admin

---

**Estado:** ✅ FIX APLICADO - LISTO PARA TESTING  
**Archivo modificado:** `src/routes/productos.routes.js`  
**Impacto:** Bajo (solo reordena rutas)  
**Riesgo:** Muy bajo (fix estándar de Express)

