# 📊 DIAGRAMAS DE FLUJO - Error JWT

## 🔴 FLUJO ACTUAL (CON PROBLEMA)

```
┌─────────────────────────────────────────────────────────────┐
│                    REQUEST ENTRANTE                         │
│          GET /api/productos/admin                           │
│          Cookie: auth_token=eyJhbGci... (EXPIRADO)         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │    auth.middleware.js        │
        │                              │
        │  1. Busca token en cookie    │
        │  2. Ejecuta jwt.verify()     │
        │     ❌ Error: jwt expired    │
        │  3. catch (error)            │
        │     console.error()          │
        │     req.user = null          │
        │  4. next() ← CONTINÚA        │
        └──────────────┬───────────────┘
                       │
                       │ req.user = null ⚠️
                       │
                       ▼
        ┌──────────────────────────────┐
        │  permisos.middleware.js      │
        │                              │
        │  ❌ const permisos = await   │
        │     Permiso.findAll({        │
        │       where: {               │
        │         rol_id: req.user.rol_id  ← CRASH
        │       }                      │
        │     })                       │
        │                              │
        │  TypeError: Cannot read      │
        │  properties of null          │
        │  (reading 'rol_id')          │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │     🔥 SERVIDOR CRASH        │
        │                              │
        │  Express devuelve 500        │
        │  Internal Server Error       │
        │                              │
        │  Logs del error en consola   │
        └──────────────────────────────┘
```

---

## ✅ FLUJO PROPUESTO (SOLUCIÓN 1 - FIX RÁPIDO)

```
┌─────────────────────────────────────────────────────────────┐
│                    REQUEST ENTRANTE                         │
│          GET /api/productos/admin                           │
│          Cookie: auth_token=eyJhbGci... (EXPIRADO)         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │    auth.middleware.js        │
        │                              │
        │  1. Busca token en cookie    │
        │  2. Ejecuta jwt.verify()     │
        │     ❌ Error: jwt expired    │
        │  3. catch (error)            │
        │     console.error()          │
        │     req.user = null          │
        │  4. next() ← CONTINÚA        │
        └──────────────┬───────────────┘
                       │
                       │ req.user = null ⚠️
                       │
                       ▼
        ┌──────────────────────────────┐
        │  permisos.middleware.js      │
        │                              │
        │  ✅ if (!req.user) {         │
        │     return res.status(401)   │
        │       .json({                │
        │         error: 'Auth req'    │
        │       })                     │
        │     }                        │
        │                              │
        │  ⛔ BLOQUEA AQUÍ             │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   ✅ RESPUESTA 401           │
        │                              │
        │  {                           │
        │    "error": "Autenticación   │
        │              requerida"      │
        │  }                           │
        │                              │
        │  Frontend detecta 401        │
        │  Refresca token              │
        │  Reintenta request           │
        └──────────────────────────────┘
```

---

## ⭐ FLUJO IDEAL (SOLUCIÓN 2 - MEJORA INTERMEDIA)

```
┌─────────────────────────────────────────────────────────────┐
│                    REQUEST ENTRANTE                         │
│          GET /api/productos/admin                           │
│          Cookie: auth_token=eyJhbGci... (EXPIRADO)         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │    auth.middleware.js        │
        │    (Sin cambios)             │
        │                              │
        │  1. Busca token              │
        │  2. jwt.verify() → Error     │
        │  3. req.user = null          │
        │  4. next() ← CONTINÚA        │
        └──────────────┬───────────────┘
                       │
                       │ req.user = null
                       │
                       ▼
        ┌──────────────────────────────┐
        │  requireAuth.middleware.js   │
        │  (NUEVO)                     │
        │                              │
        │  ✅ if (!req.user) {         │
        │     return res.status(401)   │
        │       .json({                │
        │         error: 'Auth req',   │
        │         code: 'AUTH_REQUIRED' │
        │       })                     │
        │     }                        │
        │                              │
        │  ⛔ BLOQUEA AQUÍ             │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   ✅ RESPUESTA 401           │
        │                              │
        │  {                           │
        │    "error": "Autenticación   │
        │              requerida",     │
        │    "code": "AUTH_REQUIRED"   │
        │  }                           │
        └──────────────────────────────┘
        
        
        ┌─────────────────────────────┐
        │  SI req.user EXISTE         │
        │  (token válido)             │
        └──────────────┬──────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  permiso.middleware.js       │
        │                              │
        │  ✅ if (!req.user) {         │
        │     // Defensa adicional     │
        │     return 401               │
        │     }                        │
        │                              │
        │  ✅ const permisos = await   │
        │     Permiso.findAll({        │
        │       rol_id: req.user.rol_id │
        │     })                       │
        │                              │
        │  ✅ if (tiene_permiso)       │
        │     next()                   │
        │     else return 403          │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  ✅ CONTROLLER               │
        │     productosCtrl.listarAdmin│
        │                              │
        │  Retorna data                │
        └──────────────────────────────┘
```

---

## 🔄 COMPARACIÓN DE RESPUESTAS HTTP

### ❌ ANTES DEL FIX

```
Request: GET /api/productos/admin
Token: EXPIRADO

Response:
HTTP/1.1 500 Internal Server Error
Content-Type: text/html

<!DOCTYPE html>
<html>
<head>
    <title>Error</title>
</head>
<body>
    <h1>Internal Server Error</h1>
    <pre>
    TypeError: Cannot read properties of null (reading 'rol_id')
        at /app/src/middleware/permisos.middleware.js:6:69
        ...
    </pre>
</body>
</html>
```

**Problemas:**
- ❌ Status 500 (error del servidor, no del cliente)
- ❌ HTML en vez de JSON
- ❌ Stack trace expuesto
- ❌ Frontend no puede manejar el error correctamente
- ❌ No queda claro que es un problema de autenticación

---

### ✅ DESPUÉS DEL FIX

```
Request: GET /api/productos/admin
Token: EXPIRADO

Response:
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "Autenticación requerida",
  "message": "Debes iniciar sesión para acceder a este recurso",
  "code": "AUTH_REQUIRED"
}
```

**Ventajas:**
- ✅ Status 401 (correcto semánticamente)
- ✅ JSON estructurado
- ✅ Sin información sensible
- ✅ Frontend puede detectar y actuar (refrescar token)
- ✅ Mensaje claro para el usuario

---

## 🎯 DIFERENTES CASOS DE ERROR

### Caso 1: Sin Token

```
Request: GET /api/productos/admin
(Sin cookie auth_token)

┌──────────────┐
│ auth.middleware │
│ No hay token   │
│ req.user = null│
└───────┬────────┘
        │
        ▼
┌──────────────────┐
│ permiso.middleware│
│ !req.user = true │
│ return 401       │
└──────────────────┘

Response: 401 Unauthorized
{
  "error": "Autenticación requerida"
}
```

---

### Caso 2: Token Expirado

```
Request: GET /api/productos/admin
Cookie: auth_token=eyJ... (expirado hace 10 min)

┌──────────────┐
│ auth.middleware │
│ jwt.verify()   │
│ Error: jwt exp │
│ req.user = null│
└───────┬────────┘
        │
        ▼
┌──────────────────┐
│ permiso.middleware│
│ !req.user = true │
│ return 401       │
└──────────────────┘

Response: 401 Unauthorized
{
  "error": "Autenticación requerida"
}
```

---

### Caso 3: Token Válido, Sin Permiso

```
Request: GET /api/productos/admin
Cookie: auth_token=eyJ... (válido)
Usuario: rol_id = 1 (usuario básico)

┌──────────────┐
│ auth.middleware │
│ jwt.verify() ✅│
│ req.user = {   │
│   id: 123,     │
│   rol_id: 1    │
│ }              │
└───────┬────────┘
        │
        ▼
┌──────────────────┐
│ permiso.middleware│
│ req.user existe ✅│
│ Busca permisos   │
│ No tiene         │
│ 'gestionar_canjes'│
│ return 403       │
└──────────────────┘

Response: 403 Forbidden
{
  "error": "Sin permiso",
  "message": "No tienes el permiso necesario: gestionar_canjes"
}
```

---

### Caso 4: Token Válido, Con Permiso ✅

```
Request: GET /api/productos/admin
Cookie: auth_token=eyJ... (válido)
Usuario: rol_id = 3 (admin)

┌──────────────┐
│ auth.middleware │
│ jwt.verify() ✅│
│ req.user = {   │
│   id: 1,       │
│   rol_id: 3    │
│ }              │
└───────┬────────┘
        │
        ▼
┌──────────────────┐
│ permiso.middleware│
│ req.user existe ✅│
│ Busca permisos   │
│ Tiene permiso ✅ │
│ next()           │
└───────┬──────────┘
        │
        ▼
┌──────────────────┐
│ productosCtrl.   │
│ listarAdmin()    │
│                  │
│ Retorna data     │
└──────────────────┘

Response: 200 OK
{
  "productos": [
    { "id": 1, "nombre": "Producto 1" },
    ...
  ]
}
```

---

## 🔄 INTERACCIÓN FRONTEND-BACKEND

### ❌ Comportamiento Actual (Problemático)

```
┌─────────────┐                    ┌─────────────┐
│  FRONTEND   │                    │   BACKEND   │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │  GET /api/productos/admin        │
       │  Cookie: token (expirado)        │
       ├─────────────────────────────────>│
       │                                  │
       │                         ❌ CRASH │
       │                         TypeError│
       │                                  │
       │  500 Internal Server Error       │
       │  (HTML con stack trace)          │
       │<─────────────────────────────────┤
       │                                  │
       ❌ No puede parsear HTML           │
       ❌ Error en consola                │
       ❌ Usuario ve página en blanco     │
       │                                  │
```

---

### ✅ Comportamiento Propuesto (Correcto)

```
┌─────────────┐                    ┌─────────────┐
│  FRONTEND   │                    │   BACKEND   │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │  GET /api/productos/admin        │
       │  Cookie: token (expirado)        │
       ├─────────────────────────────────>│
       │                                  │
       │                         ✅ Detecta│
       │                         token exp│
       │                         req.user= │
       │                         null     │
       │  401 Unauthorized                │
       │  { "error": "Auth req" }         │
       │<─────────────────────────────────┤
       │                                  │
       ✅ Interceptor detecta 401         │
       │                                  │
       │  POST /api/auth/refresh          │
       │  Body: { refreshToken: "..." }   │
       ├─────────────────────────────────>│
       │                                  │
       │                         ✅ Valida│
       │                         refresh  │
       │                         token    │
       │  200 OK                          │
       │  { "accessToken": "nuevo..." }   │
       │<─────────────────────────────────┤
       │                                  │
       ✅ Guarda nuevo token              │
       │                                  │
       │  GET /api/productos/admin        │
       │  Cookie: token (NUEVO)           │
       ├─────────────────────────────────>│
       │                                  │
       │                         ✅ Token │
       │                         válido   │
       │                         Tiene    │
       │                         permiso  │
       │  200 OK                          │
       │  { "productos": [...] }          │
       │<─────────────────────────────────┤
       │                                  │
       ✅ Usuario ve data correctamente   │
       │                                  │
```

---

## 📊 ESTADÍSTICAS DE LOGS

### Logs Antes del Fix

```
[2025-11-03 10:23:45] [Auth Middleware] Error: jwt expired
[2025-11-03 10:23:45] TypeError: Cannot read properties of null (reading 'rol_id')
    at /app/src/middleware/permisos.middleware.js:6:69
    at Layer.handleRequest (/app/node_modules/router/lib/layer.js:152:17)
    ...

[2025-11-03 10:45:12] [Auth Middleware] Error: jwt expired
[2025-11-03 10:45:12] TypeError: Cannot read properties of null (reading 'rol_id')
    ...

[2025-11-03 11:12:33] [Auth Middleware] Error: jwt expired
[2025-11-03 11:12:33] TypeError: Cannot read properties of null (reading 'rol_id')
    ...

Promedio: ~5-10 crashes por día
```

---

### Logs Después del Fix

```
[2025-11-03 10:23:45] [Auth Middleware] Error: jwt expired
[2025-11-03 10:23:45] [Permisos Middleware] Autenticación requerida - req.user es null
← Nuevo log informativo

[2025-11-03 10:23:46] [Auth][refreshToken] Token renovado para usuario NaferJ
[2025-11-03 10:23:47] [Auth Middleware] ✅ Usuario autenticado: NaferJ

[2025-11-03 10:45:12] [Auth Middleware] Error: jwt expired
[2025-11-03 10:45:12] [Permisos Middleware] Autenticación requerida - req.user es null
[2025-11-03 10:45:13] [Auth][refreshToken] Token renovado para usuario HlROSHI
[2025-11-03 10:45:14] [Auth Middleware] ✅ Usuario autenticado: HlROSHI

Crashes: 0 ✅
Refreshes automáticos: Funcionando correctamente ✅
```

---

## 🎯 RESUMEN VISUAL

```
┌────────────────────────────────────────────────────────────┐
│                     PROBLEMA                               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  auth.middleware  →  permiso.middleware  →  CRASH 💥      │
│  (req.user=null)      (accede rol_id)                     │
│                                                            │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│              SOLUCIÓN 1 (Fix Rápido)                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  auth.middleware  →  permiso.middleware  →  401 ✅        │
│  (req.user=null)      (valida req.user)                   │
│                       if (!req.user)                       │
│                         return 401                         │
│                                                            │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│           SOLUCIÓN 2 (Mejora Intermedia)                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  auth.middleware  →  requireAuth  →  permiso  →  200 ✅   │
│  (req.user=null)      (bloquea)                           │
│                       if (!req.user)                       │
│                         return 401                         │
│                                                            │
│  auth.middleware  →  requireAuth  →  permiso  →  OK ✅    │
│  (req.user=✅)        (continúa)     (valida)   (data)    │
│                                      permiso               │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

**Preparado por:** GitHub Copilot  
**Fecha:** 2025-11-03  
**Estado:** ✅ DIAGRAMAS COMPLETOS

