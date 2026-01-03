# 📬 Sistema de Notificaciones - Guía para Frontend

## 🎯 Resumen para el Frontend Team

El backend tiene implementado un **sistema profesional de notificaciones** listo para ser consumido por tu frontend.

### Endpoints Disponibles

```
GET    /api/notificaciones                    Listar notificaciones
GET    /api/notificaciones/no-leidas/contar   Contar no leídas  
GET    /api/notificaciones/:id                Obtener detalle
PATCH  /api/notificaciones/:id/leido          Marcar como leída
PATCH  /api/notificaciones/leer-todas         Marcar todas como leídas
DELETE /api/notificaciones/:id                Eliminar notificación
```

---

## 🔐 Autenticación

**Todos los endpoints requieren autenticación:**

```javascript
// Header requerido:
Authorization: Bearer <TOKEN_JWT>
```

---

## 📋 Ejemplos de Requests y Responses

### 1. Listar Notificaciones (GET)

**Request:**
```http
GET /api/notificaciones?page=1&limit=20&tipo=puntos_ganados&estado=no_leida
Authorization: Bearer <token>
```

**Query Parameters:**
- `page`: Número de página (default: 1)
- `limit`: Registros por página (default: 20, máximo: 100)
- `tipo`: Filtro por tipo (opcional) - Ver tipos abajo
- `estado`: Filtro por estado (opcional) - 'leida' o 'no_leida'

**Response (200 OK):**
```json
{
  "total": 15,
  "page": 1,
  "limit": 20,
  "pages": 1,
  "notificaciones": [
    {
      "id": 1,
      "usuario_id": 5,
      "titulo": "¡Ganaste 100 puntos!",
      "descripcion": "Has ganado 100 puntos por: Canje de recompensa: Extra Kick",
      "tipo": "puntos_ganados",
      "estado": "no_leida",
      "datos_relacionados": {
        "cantidad": 100,
        "concepto": "Canje de recompensa: Extra Kick",
        "tipo_evento": "channel.reward.redemption.updated"
      },
      "enlace_detalle": "/historial-puntos",
      "fecha_lectura": null,
      "deleted_at": null,
      "fecha_creacion": "2026-01-03T10:30:45.000Z",
      "fecha_actualizacion": "2026-01-03T10:30:45.000Z"
    },
    // ... más notificaciones
  ]
}
```

---

### 2. Contar No Leídas (GET)

**Request:**
```http
GET /api/notificaciones/no-leidas/contar
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "cantidad": 3
}
```

**Caso de Uso:** Mostrar badge en el header con el número de notificaciones no leídas.

---

### 3. Obtener Detalle (GET)

**Request:**
```http
GET /api/notificaciones/1
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": 1,
  "usuario_id": 5,
  "titulo": "¡Tu canje fue entregado!",
  "descripcion": "Tu canje de \"VIP Mensual\" ha sido marcado como entregado",
  "tipo": "canje_entregado",
  "estado": "leida",
  "datos_relacionados": {
    "canje_id": 42,
    "nombre_producto": "VIP Mensual"
  },
  "enlace_detalle": "/canjes/42",
  "fecha_lectura": "2026-01-03T10:35:20.000Z",
  "deleted_at": null,
  "fecha_creacion": "2026-01-03T10:30:45.000Z",
  "fecha_actualizacion": "2026-01-03T10:30:45.000Z"
}
```

⚠️ **IMPORTANTE**: Al obtener el detalle, **automáticamente se marca como leída**. El campo `estado` cambia a "leida" y `fecha_lectura` se actualiza.

**Response (404 Not Found):**
```json
{
  "error": "Notificación no encontrada"
}
```

---

### 4. Marcar Como Leída (PATCH)

**Request:**
```http
PATCH /api/notificaciones/1/leido
Authorization: Bearer <token>
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "mensaje": "Notificación marcada como leída",
  "notificacion": {
    "id": 1,
    "usuario_id": 5,
    "estado": "leida",
    "fecha_lectura": "2026-01-03T10:35:20.000Z",
    // ... resto de campos
  }
}
```

---

### 5. Marcar Todas Como Leídas (PATCH)

**Request:**
```http
PATCH /api/notificaciones/leer-todas
Authorization: Bearer <token>
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "mensaje": "Todas las notificaciones marcadas como leídas",
  "cantidad_actualizadas": 12
}
```

---

### 6. Eliminar Notificación (DELETE)

**Request:**
```http
DELETE /api/notificaciones/1
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": 1,
  "mensaje": "Notificación eliminada"
}
```

⚠️ **NOTA**: Es un "soft delete". La notificación se marca como eliminada pero permanece en la BD para auditoría.

---

## 🎨 Tipos de Notificaciones

| Tipo | Icono | Color | Ejemplo | Enlace |
|------|-------|-------|---------|--------|
| `sub_regalada` | 🎁 | success | "¡Recibiste un regalo de suscripción!" | `/suscripciones` |
| `puntos_ganados` | 💰 | info | "¡Ganaste 100 puntos!" | `/historial-puntos` |
| `canje_creado` | 🛍️ | primary | "¡Canje creado!" | `/canjes/{id}` |
| `canje_entregado` | ✅ | success | "¡Tu canje fue entregado!" | `/canjes/{id}` |
| `canje_cancelado` | ❌ | danger | "Tu canje fue cancelado" | `/canjes/{id}` |
| `canje_devuelto` | ↩️ | warning | "Tu canje fue devuelto" | `/canjes/{id}` |
| `historial_evento` | 📝 | secondary | Evento importante | `/historial-puntos` |
| `sistema` | ⚡ | info | Notificación general | N/A |

---

## 💻 Implementación en React (Ejemplo Completo)

### 1. Custom Hook para Notificaciones

```jsx
// hooks/useNotificaciones.js
import { useState, useEffect, useCallback } from 'react';

export function useNotificaciones(token) {
  const [notificaciones, setNotificaciones] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchNotificaciones = useCallback(async (page = 1, limit = 20) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/notificaciones?page=${page}&limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const data = await response.json();
      setNotificaciones(data.notificaciones);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchNoLeidas = useCallback(async () => {
    try {
      const response = await fetch(
        '/api/notificaciones/no-leidas/contar',
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const data = await response.json();
      setNoLeidas(data.cantidad);
    } catch (err) {
      console.error('Error contando no leídas:', err);
    }
  }, [token]);

  const marcarComoLeida = useCallback(async (id) => {
    try {
      await fetch(`/api/notificaciones/${id}/leido`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchNoLeidas();
      await fetchNotificaciones();
    } catch (err) {
      console.error('Error marcando como leída:', err);
    }
  }, [token, fetchNoLeidas, fetchNotificaciones]);

  const marcarTodasLeidas = useCallback(async () => {
    try {
      await fetch('/api/notificaciones/leer-todas', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchNoLeidas();
      await fetchNotificaciones();
    } catch (err) {
      console.error('Error:', err);
    }
  }, [token, fetchNoLeidas, fetchNotificaciones]);

  const eliminarNotificacion = useCallback(async (id) => {
    try {
      await fetch(`/api/notificaciones/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchNotificaciones();
      await fetchNoLeidas();
    } catch (err) {
      console.error('Error eliminando:', err);
    }
  }, [token, fetchNotificaciones, fetchNoLeidas]);

  useEffect(() => {
    fetchNotificaciones();
    fetchNoLeidas();
    
    // Refrescar cada 30 segundos
    const interval = setInterval(() => {
      fetchNoLeidas();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchNotificaciones, fetchNoLeidas]);

  return {
    notificaciones,
    noLeidas,
    loading,
    error,
    fetchNotificaciones,
    marcarComoLeida,
    marcarTodasLeidas,
    eliminarNotificacion,
    fetchNoLeidas
  };
}
```

### 2. Componente de Notificaciones

```jsx
// components/NotificationCenter.jsx
import React from 'react';
import { useNotificaciones } from '../hooks/useNotificaciones';
import { useAuth } from '../context/AuthContext'; // o tu hook de auth
import './NotificationCenter.css';

const iconMap = {
  sub_regalada: '🎁',
  puntos_ganados: '💰',
  canje_creado: '🛍️',
  canje_entregado: '✅',
  canje_cancelado: '❌',
  canje_devuelto: '↩️',
  historial_evento: '📝',
  sistema: '⚡'
};

const colorMap = {
  sub_regalada: 'success',
  puntos_ganados: 'info',
  canje_creado: 'primary',
  canje_entregado: 'success',
  canje_cancelado: 'danger',
  canje_devuelto: 'warning',
  historial_evento: 'secondary',
  sistema: 'info'
};

export function NotificationCenter() {
  const { token } = useAuth();
  const {
    notificaciones,
    noLeidas,
    loading,
    marcarComoLeida,
    marcarTodasLeidas,
    eliminarNotificacion
  } = useNotificaciones(token);

  const handleClickNotificacion = async (notificacion) => {
    // Marcar como leída
    await marcarComoLeida(notificacion.id);

    // Navegar si tiene enlace
    if (notificacion.enlace_detalle) {
      window.location.href = notificacion.enlace_detalle;
    }
  };

  return (
    <div className="notification-center">
      <div className="notification-header">
        <h2>
          Notificaciones
          {noLeidas > 0 && <span className="badge">{noLeidas}</span>}
        </h2>
        {noLeidas > 0 && (
          <button 
            onClick={marcarTodasLeidas}
            className="btn-secondary"
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading">Cargando notificaciones...</div>
      ) : notificaciones.length === 0 ? (
        <div className="empty-state">No tienes notificaciones</div>
      ) : (
        <div className="notifications-list">
          {notificaciones.map(notif => (
            <div
              key={notif.id}
              className={`notification-item color-${colorMap[notif.tipo]} ${
                notif.estado === 'no_leida' ? 'unread' : 'read'
              }`}
              onClick={() => handleClickNotificacion(notif)}
            >
              <div className="notification-icon">
                {iconMap[notif.tipo] || '📬'}
              </div>

              <div className="notification-content">
                <h3>{notif.titulo}</h3>
                <p>{notif.descripcion}</p>
                <small>
                  {new Date(notif.fecha_creacion).toLocaleString()}
                </small>
              </div>

              {notif.estado === 'no_leida' && (
                <div className="unread-indicator"></div>
              )}

              <button
                className="btn-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  eliminarNotificacion(notif.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 3. Componente Badge (Para Header)

```jsx
// components/NotificationBadge.jsx
import React from 'react';
import { useNotificaciones } from '../hooks/useNotificaciones';
import { useAuth } from '../context/AuthContext';

export function NotificationBadge() {
  const { token } = useAuth();
  const { noLeidas } = useNotificaciones(token);

  return (
    <button className="notification-badge">
      🔔
      {noLeidas > 0 && <span className="badge">{noLeidas}</span>}
    </button>
  );
}
```

### 4. CSS (Ejemplo)

```css
/* NotificationCenter.css */

.notification-center {
  max-width: 500px;
  margin: 20px auto;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid #eee;
  background: #f9f9f9;
}

.notification-header h2 {
  margin: 0;
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.badge {
  background: #ff4444;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.notifications-list {
  max-height: 500px;
  overflow-y: auto;
}

.notification-item {
  display: flex;
  gap: 12px;
  padding: 12px 15px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background 0.2s;
  position: relative;
}

.notification-item:hover {
  background: #f5f5f5;
}

.notification-item.unread {
  background: #f0f7ff;
  font-weight: 500;
}

.notification-item.color-success {
  border-left: 4px solid #4caf50;
}

.notification-item.color-danger {
  border-left: 4px solid #ff4444;
}

.notification-item.color-warning {
  border-left: 4px solid #ff9800;
}

.notification-item.color-info {
  border-left: 4px solid #2196f3;
}

.notification-icon {
  font-size: 24px;
  min-width: 30px;
  text-align: center;
}

.notification-content {
  flex: 1;
}

.notification-content h3 {
  margin: 0 0 5px 0;
  font-size: 14px;
}

.notification-content p {
  margin: 0 0 5px 0;
  font-size: 13px;
  color: #666;
}

.notification-content small {
  color: #999;
  font-size: 11px;
}

.unread-indicator {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff4444;
}

.btn-delete {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
  padding: 0 5px;
}

.btn-delete:hover {
  color: #ff4444;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}
```

### 5. Uso en App

```jsx
// App.jsx
import { NotificationCenter } from './components/NotificationCenter';
import { NotificationBadge } from './components/NotificationBadge';

export function App() {
  return (
    <>
      <header>
        <h1>Mi Aplicación</h1>
        <NotificationBadge /> {/* Badge en header */}
      </header>

      <main>
        <NotificationCenter /> {/* Centro de notificaciones */}
      </main>
    </>
  );
}
```

---

## 🔄 Flujo Recomendado

1. **Listar notificaciones** al cargar la página
2. **Contar no leídas** para mostrar badge en header
3. **Refrescar cada 30 segundos** para nuevas notificaciones
4. Al hacer click en una notificación:
   - Se marca como leída automáticamente
   - Se navega al `enlace_detalle`
5. Mostrar opción "Marcar todas como leídas" si hay no leídas

---

## ⚠️ Consideraciones

### Límites
- Máximo 100 notificaciones por página
- Máximo 1000 notificaciones por usuario (recomendado limpiar después)

### Performance
- Cache local de notificaciones (localStorage)
- Refrescar solo contador cada 30 segundos (más rápido)
- Refrescar lista completa cada 5 minutos o al hacer click

### Errores Comunes
- ❌ Olvidar header de autenticación
- ❌ Usar estados locales sin refrescar del servidor
- ❌ No manejar errores de red
- ✅ Usar custom hooks para lógica reutilizable

---

## 🚀 Próximos Pasos

1. Copiar el código del hook y componentes
2. Adaptarlos a tu estructura de proyecto
3. Ajustar estilos CSS según tu diseño
4. Testear con la API
5. Agregar tipos TypeScript (opcional pero recomendado)

---

## 📚 Documentación Backend Completa

Ver archivos en el backend:
- `SISTEMA-NOTIFICACIONES-IMPLEMENTACION.md` - Documentación técnica
- `SISTEMA-NOTIFICACIONES-EJEMPLOS.md` - Más ejemplos
- `NOTIFICACIONES-VISUAL.md` - Diagramas y arquitectura

¡A implementar! 🚀

