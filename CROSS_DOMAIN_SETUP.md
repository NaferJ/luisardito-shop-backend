# 🍪 CONFIGURACIÓN COMPLETA - COOKIES CROSS-DOMAIN

## ✅ **IMPLEMENTACIÓN COMPLETADA EN EL BACKEND**

### **📁 ARCHIVOS CREADOS:**

1. **`src/middleware/cors.middleware.js`** - CORS personalizado para subdominios
2. **`src/utils/cookies.util.js`** - Utilidades para manejo de cookies cross-domain

### **🔧 ARCHIVOS MODIFICADOS:**

1. **`app.js`** - Integración de CORS personalizado y cookie-parser
2. **`src/controllers/auth.controller.js`** - Todos los endpoints actualizados para usar cookies
3. **`src/routes/auth.routes.js`** - Nueva ruta para debugging de cookies
4. **`config.js`** - Configuración de cookies agregada
5. **`.github/workflows/prod-cd.yml`** - Variable COOKIE_DOMAIN agregada

### **📦 DEPENDENCIAS AGREGADAS:**

```bash
npm install cookie-parser  # ✅ Ya instalado
```

---

## 🎯 **FUNCIONALIDADES IMPLEMENTADAS**

### **1. CORS Cross-Domain ✅**
```javascript
// Permite subdominios de luisardito.com
origin: ['https://luisardito.com', 'https://shop.luisardito.com']
credentials: true  // CRÍTICO para cookies
```

### **2. Cookies Cross-Domain ✅**
```javascript
// Configuración automática según entorno
domain: '.luisardito.com'  // En producción
sameSite: 'lax'           // Permite subdominios
secure: true              // HTTPS en producción
```

### **3. Endpoints Actualizados ✅**
- **Login Local** → Configura cookies automáticamente
- **Login con Kick** → Configura cookies automáticamente  
- **Refresh Token** → Actualiza cookies automáticamente
- **Logout** → Limpia cookies automáticamente
- **Logout All** → Limpia cookies automáticamente

### **4. Debugging ✅**
- **`GET /api/auth/cookie-status`** → Verifica estado de cookies
- **Logging detallado** → Para troubleshooting

---

## 🚀 **CÓMO FUNCIONA**

### **En Desarrollo (localhost):**
```javascript
domain: undefined          // Cookies normales de localhost
secure: false              // HTTP permitido
sameSite: 'lax'            // Funcional
```

### **En Producción (luisardito.com):**
```javascript
domain: '.luisardito.com'   // Compartido entre subdominios
secure: true               // Solo HTTPS
sameSite: 'lax'            // Cross-subdomain
```

---

## 🧪 **ENDPOINTS PARA TESTING**

### **1. Verificar Estado de Cookies:**
```bash
GET https://api.luisardito.com/api/auth/cookie-status
```

**Respuesta esperada:**
```json
{
  "hasCookies": true,
  "authToken": "presente",
  "refreshToken": "presente",
  "environment": "production",
  "domain": ".luisardito.com",
  "userAgent": "Mozilla/5.0...",
  "origin": "https://luisardito.com"
}
```

### **2. Login (configura cookies automáticamente):**
```bash
POST https://api.luisardito.com/api/auth/login
POST https://api.luisardito.com/api/auth/kick-callback
```

### **3. Logout (limpia cookies automáticamente):**
```bash
POST https://api.luisardito.com/api/auth/logout
```

---

## 🔍 **LOGS PARA DEBUGGING**

### **Configuración de Cookies:**
```
[Cookies] Configurando cookies de autenticación
[Cookies] Entorno: production
[Cookies] Dominio: .luisardito.com
```

### **Limpieza de Cookies:**
```
[Cookies] Limpiando cookies de autenticación
[Cookies] Entorno: production
[Cookies] Dominio: .luisardito.com
```

### **CORS:**
```
[CORS] Origen no permitido: https://malicious-site.com
```

---

## 🌍 **VARIABLES DE ENTORNO**

### **Automáticas (ya configuradas):**
```env
NODE_ENV=production
COOKIE_DOMAIN=.luisardito.com  # ✅ Ya en workflow
FRONTEND_URL=https://luisardito.com
```

### **Opcionales:**
```env
# Si necesitas personalizar más
FRONTEND_URLS=https://luisardito.com,https://shop.luisardito.com
```

---

## ✅ **RESULTADO ESPERADO**

### **Comportamiento en Producción:**

1. **Usuario se loguea en luisardito.com:**
   - ✅ Cookies se configuran con `domain=.luisardito.com`
   - ✅ `auth_token` y `refresh_token` disponibles

2. **Usuario navega a shop.luisardito.com:**
   - ✅ Cookies automáticamente disponibles
   - ✅ Usuario aparece logueado
   - ✅ API calls funcionan sin re-autenticación

3. **Usuario hace logout en cualquier sitio:**
   - ✅ Cookies se limpian en ambos dominios
   - ✅ Usuario aparece deslogueado en ambos sitios

### **Compatibilidad:**
- ✅ **Desarrollo**: Funciona en localhost normalmente
- ✅ **Producción**: Funciona cross-domain automáticamente
- ✅ **Migración**: El frontend ya maneja la migración de localStorage
- ✅ **Fallback**: Si cookies fallan, funciona con localStorage

---

## 🔧 **TROUBLESHOOTING**

### **Si las cookies no aparecen:**
1. Verificar que `credentials: true` esté en CORS ✅
2. Verificar que `domain` sea correcto ✅
3. Usar `GET /api/auth/cookie-status` para debugging ✅

### **Si CORS falla:**
1. Verificar que el origen esté en `allowedOrigins` ✅
2. Revisar logs de CORS en el servidor ✅

### **Si no funciona en desarrollo:**
1. Usar `http://localhost:5173` (debe estar en allowedOrigins) ✅
2. No usar `domain` en localhost ✅

---

## 🎉 **¡IMPLEMENTACIÓN COMPLETA!**

**Todo está configurado y listo. El backend ahora:**

- ✅ **Permite CORS cross-domain** con credenciales
- ✅ **Configura cookies automáticamente** en login
- ✅ **Limpia cookies automáticamente** en logout  
- ✅ **Funciona en desarrollo y producción**
- ✅ **Incluye debugging tools**
- ✅ **Compatible con el frontend actualizado**