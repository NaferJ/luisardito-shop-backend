# 🔗 URL CORRECTA DEL BACKEND PARA FRONTEND

## ✅ Configuración del Backend

**Puerto del Backend**: `3000` (configurable en `config.js`)

```javascript
// config.js línea 58
port: Number(process.env.PORT || 3000),
```

**CORS Permitidos:**
- ✅ `http://localhost:3000`
- ✅ `http://localhost:3001` 
- ✅ `http://localhost:3002`
- ✅ `http://localhost:5173` (Vite)
- ✅ `http://127.0.0.1:3000`
- ✅ `http://127.0.0.1:3001`
- ✅ `http://127.0.0.1:3002`
- ✅ `http://127.0.0.1:5173`
- ✅ `https://luisardito.com`
- ✅ `https://shop.luisardito.com`

---

## 🎯 URL Correcta para Frontend

**Base URL que debe usar axios:**
```javascript
const api = axios.create({
  baseURL: 'http://localhost:3000'  // ← ESTA ES LA CORRECTA
})
```

**O si estás en desarrollo con Vite (puerto 5173):**
```javascript
const api = axios.create({
  baseURL: 'http://localhost:3000'  // Backend siempre en 3000
})
```

---

## 📝 Endpoint Completo

Para el endpoint de notificaciones:

```javascript
const { data } = await api.patch('/api/notificaciones/leer-todas')
```

**URL Completa**: `http://localhost:3000/api/notificaciones/leer-todas`

---

## 🔐 Header Requerido

Todas las peticiones deben incluir el token JWT:

```javascript
const { data } = await api.patch(
  '/api/notificaciones/leer-todas',
  {},
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
)
```

O si axios está configurado con interceptores (recomendado):

```javascript
api.interceptors.request.use(config => {
  config.headers.Authorization = `Bearer ${getToken()}`
  return config
})
```

---

## ✅ Checklist

- [ ] axios está configurado con `baseURL: 'http://localhost:3000'`
- [ ] Header `Authorization` se envía en cada request
- [ ] Frontend corre en puerto 5173, 3001, 3002 u otro permitido
- [ ] Backend corre en puerto 3000
- [ ] CORS no muestra errores

---

## 🚨 Si Aún no Funciona

Verifica en la consola del navegador (F12):

1. **¿Qué error específico muestra?**
   - `CORS error` → Backend no permite tu origen
   - `Network error` → Backend no está en http://localhost:3000
   - `401 Unauthorized` → Token JWT es inválido
   - `404 Not Found` → Endpoint no existe

2. **¿El backend realmente está en 3000?**
   Busca en los logs del backend:
   ```
   🚀 Servidor escuchando en http://localhost:3000
   ```

3. **¿axios tiene la baseURL correcta?**
   En DevTools → Network → verifica que la request vaya a `http://localhost:3000/api/notificaciones/leer-todas`

---

**La URL es correcta. Verifica que axios esté configurada así en el frontend.** ✅

