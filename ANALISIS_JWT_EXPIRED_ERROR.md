# 🔍 ANÁLISIS EXHAUSTIVO: Error `jwt expired` y `Cannot read properties of null (reading 'rol_id')`

## 📅 Fecha: 2025-11-03
## 🎯 Objetivo: Identificar la raíz del problema sin modificar código

---

## 🚨 ERRORES REPORTADOS

### Error #1: JWT Expired (Frecuente)
```
[Auth Middleware] Error: jwt expired
```

### Error #2: Cannot read properties of null (Crítico)
```
TypeError: Cannot read properties of null (reading 'rol_id')
    at /app/src/middleware/permisos.middleware.js:6:69
```

---

## 🔬 ANÁLISIS DE CÓDIGO

### 1. ⚠️ PROBLEMA CRÍTICO: `permisos.middleware.js` (LÍNEA 6)

**Ubicación:** `src/middleware/permisos.middleware.js:6`

**Código actual:**
```javascript
module.exports = function(verboPermiso) {
    return async (req, res, next) => {
        const permisos = await Permiso.findAll({
            include: { model: RolPermiso, where: { rol_id: req.user.rol_id } }  // ← LÍNEA 6
        });
        const nombres = permisos.map(p => p.nombre);
        if (nombres.includes(verboPermiso)) return next();
        res.status(403).json({ error: 'Sin permiso' });
    };
};
```

**❌ FALLO IDENTIFICADO:**

El middleware **asume que `req.user` siempre existe**, pero no hay validación. Si `req.user` es `null`, entonces `req.user.rol_id` lanza el error:

```
Cannot read properties of null (reading 'rol_id')
```

---

### 2. 🔄 FLUJO DE AUTENTICACIÓN

#### Paso 1: `auth.middleware.js` se ejecuta primero

```javascript
// auth.middleware.js
module.exports = async (req, res, next) => {
  try {
    let token = req.cookies?.auth_token;
    
    if (!token && req.headers?.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // ✅ Si no hay token, setea req.user = null
    if (!token) {
      req.user = null;
      return next();  // ← CONTINÚA AL SIGUIENTE MIDDLEWARE
    }
    
    // Verificar token
    const payload = jwt.verify(token, config.jwtSecret);  // ← PUEDE LANZAR "jwt expired"
    const user = await Usuario.findByPk(payload.userId, { include: Rol });
    
    if (!user) {
      req.user = null;  // ← Usuario no encontrado
      return next();
    }
    
    req.user = user;  // ← Usuario encontrado
    next();
    
  } catch (error) {
    // ✅ Si el token expira, setea req.user = null
    console.error('[Auth Middleware] Error:', error.message);  // ← AQUÍ SE IMPRIME "jwt expired"
    req.user = null;
    next();  // ← CONTINÚA AL SIGUIENTE MIDDLEWARE
  }
};
```

**Comportamiento:**
- ✅ Si el JWT expira → Log `[Auth Middleware] Error: jwt expired`
- ✅ Setea `req.user = null`
- ✅ Continúa al siguiente middleware (no bloquea)

#### Paso 2: `permisos.middleware.js` se ejecuta después

```javascript
// permisos.middleware.js
module.exports = function(verboPermiso) {
    return async (req, res, next) => {
        // ❌ ASUME QUE req.user EXISTE (NO HAY VALIDACIÓN)
        const permisos = await Permiso.findAll({
            include: { model: RolPermiso, where: { rol_id: req.user.rol_id } }  // ← CRASH SI req.user ES NULL
        });
        // ...
    };
};
```

**❌ Si `req.user` es `null` → CRASH del servidor con `Cannot read properties of null`**

---

## 📊 ESCENARIOS QUE CAUSAN EL ERROR

### Escenario A: JWT Expirado (Alta probabilidad)

```
1. Usuario tiene token JWT guardado en cookies
2. Token expira (después de 1 hora según TOKEN_EXPIRATION.ACCESS_TOKEN = '1h')
3. Usuario hace request a endpoint protegido (ej: /api/productos/admin)
4. auth.middleware detecta "jwt expired"
5. Setea req.user = null
6. permisos.middleware intenta acceder req.user.rol_id
7. ❌ CRASH: Cannot read properties of null (reading 'rol_id')
```

**Frecuencia:** Alta - Ocurre cada vez que un token expira y el usuario intenta acceder a un endpoint con `permiso()`.

---

### Escenario B: Token Inválido/Corrupto

```
1. Usuario tiene token corrupto en cookies
2. jwt.verify() falla
3. auth.middleware setea req.user = null
4. permisos.middleware intenta acceder req.user.rol_id
5. ❌ CRASH
```

**Frecuencia:** Media - Puede ocurrir si hay problemas de sincronización.

---

### Escenario C: Usuario No Encontrado en BD

```
1. JWT válido pero usuario fue eliminado de la BD
2. Usuario.findByPk() retorna null
3. auth.middleware setea req.user = null
4. permisos.middleware intenta acceder req.user.rol_id
5. ❌ CRASH
```

**Frecuencia:** Baja - Solo si se eliminan usuarios manualmente.

---

### Escenario D: Sin Cookies (Primera Carga Después de Logout)

```
1. Usuario hace logout
2. Cookies eliminadas
3. Usuario intenta acceder a página protegida
4. No hay token → req.user = null
5. permisos.middleware intenta acceder req.user.rol_id
6. ❌ CRASH
```

**Frecuencia:** Baja pero posible.

---

## 🎯 RUTAS AFECTADAS

Todas las rutas que usan **`auth` + `permiso()`** son vulnerables:

### ❌ Rutas Vulnerables Confirmadas:

```javascript
// productos.routes.js
router.get('/admin', auth, permiso('gestionar_canjes'), ...);  // ← VULNERABLE
router.post('/', auth, permiso('crear_producto'), ...);        // ← VULNERABLE
router.put('/:id', auth, permiso('editar_producto'), ...);     // ← VULNERABLE
router.delete('/:id', auth, permiso('eliminar_producto'), ...); // ← VULNERABLE

// canjes.routes.js
router.post('/', auth, permiso('canjear_productos'), ...);     // ← VULNERABLE
router.get('/mios', auth, permiso('ver_canjes'), ...);         // ← VULNERABLE
router.get('/', auth, permiso('gestionar_canjes'), ...);       // ← VULNERABLE
router.put('/:id', auth, permiso('gestionar_canjes'), ...);    // ← VULNERABLE

// historialPuntos.routes.js
router.get('/:usuarioId', auth, permiso('ver_historial_puntos'), ...);  // ← VULNERABLE

// usuarios.routes.js
router.get('/', auth, permiso('ver_usuarios'), ...);           // ← VULNERABLE
router.put('/:id/puntos', auth, permiso('editar_puntos'), ...); // ← VULNERABLE

// kickPointsConfig.routes.js, kickBroadcaster.routes.js, kickAdmin.routes.js
// TODAS las rutas con auth + permiso() ← VULNERABLES
```

---

## 💡 CONFIGURACIÓN ACTUAL DE TOKENS

### Duración de Access Token

**Archivo:** `src/services/tokenService.js:11`

```javascript
const TOKEN_EXPIRATION = {
    ACCESS_TOKEN: '1h',      // ← 1 HORA (NO 1 MES)
    REFRESH_TOKEN: 90        // ← 90 DÍAS
};
```

**❌ IMPORTANTE:** El access token expira en **1 hora**, NO en 1 mes como pensabas.

---

### ¿Por qué el usuario dice "aveces sale jwt expired"?

**Respuesta:** Porque el access token expira cada hora. Si el frontend no refresca el token proactivamente y el usuario hace una petición con un token expirado, el backend loga:

```
[Auth Middleware] Error: jwt expired
```

Esto es **normal** y **esperado**. El problema NO es que expire, sino que el **middleware de permisos no maneja el caso de `req.user = null`**.

---

## 🔍 ¿POR QUÉ SOLO TÚ (NAFERJ) EXPERIMENTAS EL ERROR?

### Hipótesis #1: Usas Rutas de Admin con Frecuencia

Si estás probando rutas de admin (que requieren permisos), eres más propenso a encontrar este error.

```javascript
// Ejemplo: GET /api/productos/admin
router.get('/admin', auth, permiso('gestionar_canjes'), ...);
```

Si tu token expira mientras estás en esta página:
1. ✅ `auth.middleware` → `req.user = null`
2. ❌ `permiso.middleware` → CRASH

---

### Hipótesis #2: Sesiones Largas (>1 hora)

Si mantienes la app abierta por más de 1 hora sin refrescar tokens, tu access token expira.

```
T=0min:  Login → Token válido
T=60min: Token expira
T=61min: Haces request → jwt expired → req.user = null → CRASH
```

---

### Hipótesis #3: Interceptor del Frontend No Funciona Correctamente

Si el interceptor del frontend (que refresca tokens automáticamente) falla o no se ejecuta a tiempo, el token expirado llega al backend.

---

## 🔧 ANÁLISIS DE REFRESH TOKEN

### ¿El Refresh Token Está Funcionando?

**Archivo:** `src/controllers/auth.controller.js:653`

```javascript
exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'refreshToken requerido' });
        }

        // Validar el refresh token
        const tokenRecord = await validateRefreshToken(refreshToken);

        if (!tokenRecord) {
            return res.status(401).json({ error: 'Refresh token inválido o expirado' });
        }

        // ... genera nuevo access token ...
        
        logger.info(`[Auth][refreshToken] Token renovado para usuario ${usuario.nickname}`);
        
        return res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken.token,
            expiresIn: 3600
        });
    } catch (error) {
        logger.error('[Auth][refreshToken] Error:', error.message);
        return res.status(500).json({ error: 'Error al refrescar token' });
    }
};
```

**✅ El endpoint existe y funciona.**

**Logs del usuario muestran:**
```
[Auth][refreshToken] Token renovado para usuario HlROSHI
[Auth][refreshToken] Token renovado para usuario MMHRby2005
[Auth][refreshToken] Token renovado para usuario Adriasonic745
[Auth][refreshToken] Token renovado para usuario kauphy_Xho
```

**✅ El refresh está funcionando para algunos usuarios.**

---

## 🎯 CONCLUSIÓN: RAÍZ DEL PROBLEMA

### 🚨 Problema Principal (100% confirmado):

**`permisos.middleware.js` NO valida si `req.user` es `null` antes de acceder a `req.user.rol_id`.**

```javascript
// CÓDIGO ACTUAL (LÍNEA 6)
const permisos = await Permiso.findAll({
    include: { model: RolPermiso, where: { rol_id: req.user.rol_id } }  // ← ASUME QUE req.user EXISTE
});
```

**Cuando ocurre:**
1. Token JWT expira (después de 1 hora)
2. Usuario hace request a endpoint protegido
3. `auth.middleware` detecta token expirado
4. Setea `req.user = null`
5. `permisos.middleware` intenta acceder `req.user.rol_id`
6. ❌ **CRASH del servidor**

---

### 🔄 Problema Secundario:

**El access token expira cada 1 hora, pero el frontend puede no estar refrescando tokens proactivamente en todos los casos.**

**Evidencia:**
- Usuario ve `[Auth Middleware] Error: jwt expired` en logs
- Significa que el frontend envió un token expirado al backend
- Si el interceptor del frontend funcionara perfectamente, esto no debería pasar

---

## 📋 CHECKLIST DE PROBLEMAS IDENTIFICADOS

### ✅ Confirmados:

1. ✅ **`permisos.middleware.js` no valida `req.user` antes de acceder a `rol_id`**
   - Impacto: Crítico
   - Ocurrencia: Alta
   - Causa: Cualquier situación donde `req.user = null`

2. ✅ **Access token expira en 1 hora (no en 1 mes)**
   - Impacto: Alto
   - Ocurrencia: Siempre (cada hora)
   - Causa: Configuración en `tokenService.js`

3. ✅ **`auth.middleware` permite pasar con `req.user = null` cuando falla autenticación**
   - Impacto: Medio (diseño intencional pero problemático)
   - Ocurrencia: Siempre que un token es inválido/expirado
   - Causa: Diseño permisivo del middleware

---

### ⚠️ Por Confirmar:

1. ⚠️ **Interceptor del frontend no refresca tokens proactivamente**
   - Necesita revisión del frontend
   - Puede estar enviando tokens expirados al backend

2. ⚠️ **Race condition en refresh de tokens**
   - Si múltiples requests intentan refrescar simultáneamente
   - Puede causar que algunos requests usen token expirado

---

## 🎯 SOLUCIONES PROPUESTAS (SIN IMPLEMENTAR)

### Solución #1: Validar `req.user` en `permisos.middleware.js` (CRÍTICO)

**Prioridad:** 🔴 ALTA - Soluciona el crash inmediato

**Cambio necesario:**
```javascript
// permisos.middleware.js
module.exports = function(verboPermiso) {
    return async (req, res, next) => {
        // ✅ VALIDAR QUE req.user EXISTE
        if (!req.user) {
            return res.status(401).json({ error: 'Autenticación requerida' });
        }
        
        const permisos = await Permiso.findAll({
            include: { model: RolPermiso, where: { rol_id: req.user.rol_id } }
        });
        const nombres = permisos.map(p => p.nombre);
        if (nombres.includes(verboPermiso)) return next();
        res.status(403).json({ error: 'Sin permiso' });
    };
};
```

**Impacto:**
- ✅ Previene crash del servidor
- ✅ Retorna 401 en vez de 500
- ✅ Frontend puede detectar y refrescar token

---

### Solución #2: Cambiar Comportamiento de `auth.middleware.js`

**Prioridad:** 🟡 MEDIA

**Opción A: Bloquear si el token es inválido**

```javascript
// auth.middleware.js
if (!token) {
    return res.status(401).json({ error: 'Token requerido' });  // ← BLOQUEAR
}

try {
    const payload = jwt.verify(token, config.jwtSecret);
    // ...
} catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });  // ← BLOQUEAR
}
```

**Impacto:**
- ✅ Más seguro
- ❌ Rompe rutas que necesitan autenticación opcional

**Opción B: Crear dos middlewares separados**

```javascript
// authRequired.middleware.js - Para rutas protegidas
// authOptional.middleware.js - Para rutas públicas con autenticación opcional
```

---

### Solución #3: Aumentar Duración del Access Token (NO RECOMENDADO)

**Prioridad:** 🟢 BAJA

**Cambio:**
```javascript
// tokenService.js
const TOKEN_EXPIRATION = {
    ACCESS_TOKEN: '30d',     // ← Cambiar de '1h' a '30d'
    REFRESH_TOKEN: 90
};
```

**❌ NO RECOMENDADO:**
- Mala práctica de seguridad
- Los access tokens deben ser de corta duración
- No soluciona el problema de fondo

---

### Solución #4: Mejorar Interceptor del Frontend

**Prioridad:** 🟡 MEDIA

**Revisar:**
1. ¿El interceptor detecta 401 y refresca tokens automáticamente?
2. ¿Reintenta el request original después de refrescar?
3. ¿Maneja race conditions?

---

## 📊 MATRIZ DE PRIORIDADES

| Solución | Prioridad | Complejidad | Impacto | Riesgo |
|----------|-----------|-------------|---------|--------|
| #1: Validar req.user en permisos.middleware | 🔴 ALTA | Baja | Alto | Bajo |
| #2A: Bloquear en auth.middleware | 🟡 MEDIA | Media | Medio | Medio |
| #2B: Separar middlewares | 🟡 MEDIA | Media | Alto | Bajo |
| #4: Mejorar interceptor frontend | 🟡 MEDIA | Media | Alto | Bajo |
| #3: Aumentar duración token | 🟢 BAJA | Baja | Bajo | Alto |

---

## 🚀 RECOMENDACIÓN FINAL

### Implementar en Orden:

1. **URGENTE:** Solución #1 - Validar `req.user` en `permisos.middleware.js`
   - Previene el crash inmediato
   - Bajo riesgo, alto impacto
   - Se puede desplegar inmediatamente

2. **IMPORTANTE:** Revisar interceptor del frontend
   - ¿Por qué llegan tokens expirados al backend?
   - Mejorar manejo de 401

3. **OPCIONAL:** Refactorizar middlewares
   - Separar `authRequired` y `authOptional`
   - Mejor arquitectura a largo plazo

---

## 📝 NOTAS ADICIONALES

### ¿Por Qué No Afecta a Todos los Usuarios?

- ✅ Usuarios que hacen logout/login frecuentemente → Tokens frescos
- ✅ Usuarios que solo ven productos públicos → No usan endpoints protegidos
- ❌ Admins/testers que mantienen sesiones largas → Token expira
- ❌ Usuarios que acceden a endpoints con permisos → Más propensos al error

---

### ¿Por Qué Aparece "de la nada"?

**No es "de la nada"**, es predecible:
- Ocurre exactamente 1 hora después del último refresh
- Afecta solo a usuarios que:
  1. No refrescaron su token
  2. Intentan acceder a un endpoint con `permiso()`

---

## ✅ ESTADO DEL ANÁLISIS

- ✅ Raíz del problema identificada
- ✅ Archivos afectados localizados
- ✅ Soluciones propuestas
- ✅ Prioridades definidas
- ⏳ **PENDIENTE:** Implementación de fixes

---

**Fecha de análisis:** 2025-11-03  
**Analizado por:** GitHub Copilot  
**Estado:** ✅ COMPLETO - LISTO PARA IMPLEMENTAR SOLUCIONES

