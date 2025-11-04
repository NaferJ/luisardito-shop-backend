# 🚀 GUÍA RÁPIDA - Crear Nuevas Rutas

## 📋 REFERENCIA RÁPIDA

---

## ❓ ¿QUÉ MIDDLEWARE USAR?

### 🎯 Árbol de Decisión

```
¿La ruta es pública?
  ├─ SÍ → SIN MIDDLEWARE
  │         router.get('/public', controller)
  │
  └─ NO → ¿Autenticación opcional o requerida?
            │
            ├─ OPCIONAL → auth
            │              router.get('/route', auth, controller)
            │              // req.user puede ser null
            │
            └─ REQUERIDA → ¿Necesita permisos?
                           │
                           ├─ NO → authRequired
                           │        router.get('/mi-perfil', authRequired, controller)
                           │        // req.user GARANTIZADO
                           │
                           └─ SÍ → authRequired + permiso()
                                    router.get('/admin', authRequired, permiso('ver_usuarios'), controller)
                                    // req.user GARANTIZADO + permiso verificado
```

---

## 📝 PATRONES COMUNES

### 1. Ruta Pública
```javascript
// Ejemplo: Listar productos en catálogo
router.get('/productos', productosCtrl.listar);
```

---

### 2. Ruta con Auth Opcional
```javascript
// Ejemplo: Ver producto (muestra favorito si está auth)
router.get('/productos/:id', auth, productosCtrl.ver);

// Controller:
exports.ver = async (req, res) => {
    const producto = await Producto.findByPk(req.params.id);
    
    // ✅ Verificar si hay usuario autenticado
    if (req.user) {
        producto.esFavorito = await verificarFavorito(req.user.id, producto.id);
    }
    
    res.json(producto);
};
```

---

### 3. Ruta Protegida (Sin permisos)
```javascript
// Ejemplo: Ver mi perfil
router.get('/me', authRequired, usuariosCtrl.me);

// Controller:
exports.me = async (req, res) => {
    // ✅ req.user ESTÁ GARANTIZADO
    res.json(req.user);
};
```

---

### 4. Ruta Admin (Con permisos)
```javascript
// Ejemplo: Listar todos los usuarios
router.get('/usuarios', authRequired, permiso('ver_usuarios'), usuariosCtrl.listar);

// Controller:
exports.listar = async (req, res) => {
    // ✅ req.user ESTÁ GARANTIZADO
    // ✅ Usuario TIENE el permiso 'ver_usuarios'
    const usuarios = await Usuario.findAll();
    res.json(usuarios);
};
```

---

## 📊 TABLA DE REFERENCIA RÁPIDA

| Caso de Uso | Middleware | req.user | Ejemplo |
|-------------|------------|----------|---------|
| Catálogo público | Ninguno | undefined | GET /productos |
| Ver con info extra si auth | `auth` | null o usuario | GET /productos/:id |
| Mi perfil | `authRequired` | GARANTIZADO | GET /usuarios/me |
| Listar usuarios (admin) | `authRequired` + `permiso()` | GARANTIZADO | GET /usuarios |
| Editar puntos (admin) | `authRequired` + `permiso()` | GARANTIZADO | PUT /usuarios/:id/puntos |

---

## 🎯 PERMISOS DISPONIBLES

```javascript
// Usuarios
'ver_usuarios'        // Listar usuarios
'gestionar_usuarios'  // Crear/editar/eliminar usuarios

// Productos
'ver_productos'       // (Raro, normalmente es público)
'crear_producto'      // Crear productos
'editar_producto'     // Editar productos
'eliminar_producto'   // Eliminar productos

// Canjes
'ver_canjes'          // Ver mis propios canjes
'canjear_productos'   // Realizar canjes
'gestionar_canjes'    // Ver/editar todos los canjes (admin)

// Puntos
'ver_historial_puntos'  // Ver historial de puntos
'editar_puntos'         // Modificar puntos de usuarios (admin)
```

---

## 💻 SNIPPETS DE CÓDIGO

### Crear CRUD Completo

```javascript
const router = require('express').Router();
const controller = require('../controllers/miController');
const authRequired = require('../middleware/authRequired.middleware');
const permiso = require('../middleware/permisos.middleware');

// ✅ Públicas
router.get('/', controller.listar);
router.get('/:id', controller.obtener);

// ✅ Protegidas (requieren auth + permisos)
router.post('/', authRequired, permiso('crear_recurso'), controller.crear);
router.put('/:id', authRequired, permiso('editar_recurso'), controller.editar);
router.delete('/:id', authRequired, permiso('eliminar_recurso'), controller.eliminar);

module.exports = router;
```

---

### Ruta con Auth Opcional

```javascript
router.get('/mi-ruta', auth, controller.miControlador);

// Controller:
exports.miControlador = async (req, res) => {
    const data = await obtenerData();
    
    // ✅ Verificar si hay usuario
    if (req.user) {
        // Agregar info personalizada
        data.personalizacion = await obtenerPersonalizacion(req.user.id);
    }
    
    res.json(data);
};
```

---

### Ruta Solo para Usuario Autenticado

```javascript
router.get('/mi-perfil', authRequired, controller.miPerfil);

// Controller:
exports.miPerfil = async (req, res) => {
    // ✅ NO necesitas validar req.user
    res.json({
        id: req.user.id,
        nickname: req.user.nickname,
        // ...
    });
};
```

---

### Ruta Solo para Admin con Permiso

```javascript
router.get('/admin/stats', authRequired, permiso('ver_usuarios'), controller.stats);

// Controller:
exports.stats = async (req, res) => {
    // ✅ Usuario autenticado
    // ✅ Usuario tiene permiso 'ver_usuarios'
    
    const stats = await calcularEstadisticas();
    res.json(stats);
};
```

---

## 🚨 ERRORES COMUNES

### ❌ Error 1: Olvidar `authRequired` antes de `permiso()`
```javascript
// ❌ MAL
router.get('/admin', permiso('ver_usuarios'), controller);

// ✅ BIEN
router.get('/admin', authRequired, permiso('ver_usuarios'), controller);
```

---

### ❌ Error 2: Usar `auth` cuando requieres autenticación
```javascript
// ❌ MAL (req.user puede ser null)
router.get('/mi-perfil', auth, controller);

// ✅ BIEN (req.user GARANTIZADO)
router.get('/mi-perfil', authRequired, controller);
```

---

### ❌ Error 3: Validar `req.user` en controller cuando usas `authRequired`
```javascript
// ❌ INNECESARIO
router.get('/mi-perfil', authRequired, controller);

exports.controller = async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'No auth' }); // ← INNECESARIO
    // ...
};

// ✅ MEJOR (authRequired ya garantiza req.user)
exports.controller = async (req, res) => {
    // req.user está garantizado, solo úsalo
    res.json(req.user);
};
```

---

## 🧪 TESTING RÁPIDO

```bash
# Test 1: Ruta pública
curl http://localhost:3000/api/productos
# Esperado: 200 OK

# Test 2: Ruta protegida sin token
curl http://localhost:3000/api/usuarios/me
# Esperado: 401 TOKEN_MISSING

# Test 3: Ruta protegida con token
curl http://localhost:3000/api/usuarios/me \
  -H "Cookie: auth_token=TU_TOKEN"
# Esperado: 200 OK

# Test 4: Ruta admin sin permiso
curl http://localhost:3000/api/usuarios \
  -H "Cookie: auth_token=TOKEN_USUARIO_BASICO"
# Esperado: 403 PERMISSION_DENIED

# Test 5: Ruta admin con permiso
curl http://localhost:3000/api/usuarios \
  -H "Cookie: auth_token=TOKEN_ADMIN"
# Esperado: 200 OK
```

---

## 📚 DOCUMENTACIÓN COMPLETA

Para más detalles, ver: `REFACTOR_COMPLETO_IMPLEMENTADO.md`

---

**Estado:** ✅ REFERENCIA LISTA  
**Úsala cada vez que crees una nueva ruta** 🚀

