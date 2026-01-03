# 📬 Sistema de Notificaciones - Ejemplos y Casos de Uso

## 🎯 Casos de Uso Detallados

### Caso 1: Usuario Canjea un Producto

**Flujo:**
1. Usuario autenticado hace POST a `/api/canjes` con `producto_id`
2. Sistema valida stock, puntos, aplica descuentos
3. Se crea el canje
4. **AUTOMÁTICO**: Se crea notificación de `canje_creado`
5. Usuario ve notificación en su centro de notificaciones

**Notificación Generada:**
```json
{
  "id": 1,
  "usuario_id": 123,
  "titulo": "¡Canje creado!",
  "descripcion": "Tu canje de \"VIP Mensual\" por 500 puntos ha sido creado exitosamente",
  "tipo": "canje_creado",
  "estado": "no_leida",
  "datos_relacionados": {
    "canje_id": 42,
    "nombre_producto": "VIP Mensual",
    "precio": 500,
    "promocion_aplicada": null
  },
  "enlace_detalle": "/canjes/42",
  "fecha_creacion": "2026-01-03T10:30:45.000Z"
}
```

---

### Caso 2: Admin Marca Canje Como Entregado

**Flujo:**
1. Admin hace PUT a `/api/canjes/42` con `estado: "entregado"`
2. Sistema actualiza estado y valida si es producto VIP
3. **AUTOMÁTICO**: Se crea notificación de `canje_entregado` para el usuario
4. Usuario recibe notificación inmediatamente

**Notificación Generada:**
```json
{
  "id": 2,
  "usuario_id": 123,
  "titulo": "¡Tu canje fue entregado!",
  "descripcion": "Tu canje de \"VIP Mensual\" ha sido marcado como entregado",
  "tipo": "canje_entregado",
  "estado": "no_leida",
  "datos_relacionados": {
    "canje_id": 42,
    "nombre_producto": "VIP Mensual"
  },
  "enlace_detalle": "/canjes/42",
  "fecha_creacion": "2026-01-03T10:45:30.000Z"
}
```

---

### Caso 3: Usuario Sigue al Canal en Kick

**Flujo:**
1. Usuario hace follow en Kick
2. Webhook de Kick notifica al backend (`channel.followed`)
3. Sistema verifica que es primer follow, obtiene config de puntos
4. Otorga puntos y crea historial
5. **AUTOMÁTICO**: Se crea notificación de `puntos_ganados`
6. Usuario ve notificación la próxima vez que actualiza

**Notificación Generada:**
```json
{
  "id": 3,
  "usuario_id": 123,
  "titulo": "¡Ganaste 50 puntos!",
  "descripcion": "Has ganado 50 puntos por: Primer follow al canal",
  "tipo": "puntos_ganados",
  "estado": "no_leida",
  "datos_relacionados": {
    "cantidad": 50,
    "concepto": "Primer follow al canal",
    "tipo_evento": "channel.followed"
  },
  "enlace_detalle": "/historial-puntos",
  "fecha_creacion": "2026-01-03T11:00:00.000Z"
}
```

---

### Caso 4: Usuario Canjea una Recompensa de Canal en Kick

**Flujo:**
1. Usuario ve reward en el canal de Kick
2. Usuario canjea con su puntuación de Kick
3. Webhook de Kick notifica (`channel.reward.redemption.updated`)
4. Sistema verifica reward, calcula puntos, otorga
5. **AUTOMÁTICO**: Se crea notificación de `puntos_ganados`

**Notificación Generada:**
```json
{
  "id": 4,
  "usuario_id": 123,
  "titulo": "¡Ganaste 250 puntos!",
  "descripcion": "Has ganado 250 puntos por: Canje de recompensa: Extra Kick",
  "tipo": "puntos_ganados",
  "estado": "no_leida",
  "datos_relacionados": {
    "cantidad": 250,
    "concepto": "Canje de recompensa: Extra Kick",
    "tipo_evento": "channel.reward.redemption.updated"
  },
  "enlace_detalle": "/historial-puntos",
  "fecha_creacion": "2026-01-03T11:15:30.000Z"
}
```

---

### Caso 5: Usuario Se Suscribe al Canal en Kick

**Flujo:**
1. Usuario compra suscripción en Kick
2. Webhook de Kick notifica (`channel.subscription.new`)
3. Sistema obtiene config de puntos por suscripción
4. Otorga puntos y actualiza tracking
5. **AUTOMÁTICO**: Se crea notificación de `puntos_ganados`

**Notificación Generada:**
```json
{
  "id": 5,
  "usuario_id": 123,
  "titulo": "¡Ganaste 1000 puntos!",
  "descripcion": "Has ganado 1000 puntos por: Nueva suscripción (1 mes)",
  "tipo": "puntos_ganados",
  "estado": "no_leida",
  "datos_relacionados": {
    "cantidad": 1000,
    "concepto": "Nueva suscripción (1 mes)",
    "tipo_evento": "channel.subscription.new",
    "duracion_meses": 1
  },
  "enlace_detalle": "/historial-puntos",
  "fecha_creacion": "2026-01-03T12:00:00.000Z"
}
```

---

### Caso 6: Usuario Recibe Suscripción Regalada

**Flujo:**
1. Otro usuario regala suscripción(es) en Kick
2. Webhook de Kick notifica (`channel.subscription.gifts`)
3. Sistema otorga puntos al regalador y al receptor
4. **AUTOMÁTICO**: Se crean dos notificaciones:
   - `sub_regalada` para el receptor
   - `puntos_ganados` para el regalador

**Notificación Generada (Receptor):**
```json
{
  "id": 6,
  "usuario_id": 123,
  "titulo": "¡Recibiste un regalo de suscripción!",
  "descripcion": "luisardito te regaló 1 suscripción(es)",
  "tipo": "sub_regalada",
  "estado": "no_leida",
  "datos_relacionados": {
    "regalador_username": "luisardito",
    "monto_subscription": 1,
    "puntos_otorgados": 500,
    "expires_at": "2026-02-03T12:30:00.000Z"
  },
  "enlace_detalle": "/suscripciones",
  "fecha_creacion": "2026-01-03T12:30:00.000Z"
}
```

**Notificación Generada (Regalador):**
```json
{
  "id": 7,
  "usuario_id": 999,
  "titulo": "¡Ganaste 100 puntos!",
  "descripcion": "Has ganado 100 puntos por: Regalaste 1 suscripción(es)",
  "tipo": "puntos_ganados",
  "estado": "no_leida",
  "datos_relacionados": {
    "cantidad": 100,
    "concepto": "Regalaste 1 suscripción(es)",
    "tipo_evento": "channel.subscription.gifts",
    "gifts_count": 1
  },
  "enlace_detalle": "/historial-puntos",
  "fecha_creacion": "2026-01-03T12:30:00.000Z"
}
```

---

### Caso 7: Usuario Regala Kicks

**Flujo:**
1. Usuario envía gifts de kicks en Kick
2. Webhook de Kick notifica (`kicks.gifted`)
3. Sistema calcula puntos (cantidad × multiplicador)
4. **AUTOMÁTICO**: Se crea notificación de `puntos_ganados`

**Notificación Generada:**
```json
{
  "id": 8,
  "usuario_id": 123,
  "titulo": "¡Ganaste 200 puntos!",
  "descripcion": "Has ganado 200 puntos por: Regalo de 100 kicks (Special Gift)",
  "tipo": "puntos_ganados",
  "estado": "no_leida",
  "datos_relacionados": {
    "cantidad": 200,
    "concepto": "Regalo de 100 kicks (Special Gift)",
    "tipo_evento": "kicks.gifted",
    "kick_amount": 100,
    "gift_name": "Special Gift",
    "gift_tier": "PREMIUM"
  },
  "enlace_detalle": "/historial-puntos",
  "fecha_creacion": "2026-01-03T13:00:00.000Z"
}
```

---

### Caso 8: Admin Devuelve un Canje

**Flujo:**
1. Admin hace PUT a `/api/canjes/42/devolver` con motivo
2. Sistema marca como devuelto, devuelve puntos, repone stock
3. **AUTOMÁTICO**: Se crea notificación de `canje_devuelto`
4. Usuario recibe notificación del reembolso

**Notificación Generada:**
```json
{
  "id": 9,
  "usuario_id": 123,
  "titulo": "Tu canje fue devuelto",
  "descripcion": "Tu canje de \"VIP Mensual\" ha sido devuelto y se te devolvieron 500 puntos",
  "tipo": "canje_devuelto",
  "estado": "no_leida",
  "datos_relacionados": {
    "canje_id": 42,
    "nombre_producto": "VIP Mensual",
    "puntos_devueltos": 500,
    "motivo": "Producto no disponible temporalmente"
  },
  "enlace_detalle": "/canjes/42",
  "fecha_creacion": "2026-01-03T13:30:00.000Z"
}
```

---

## 🔄 Flujos de Lectura de Notificaciones

### Flujo 1: Usuario Ve Centro de Notificaciones

```
GET /api/notificaciones?page=1&limit=20
↓
Response con 20 notificaciones (las no leídas primero)
↓
Frontend renderiza con badge "3 no leídas"
↓
Usuario hace click en notificación
↓
GET /api/notificaciones/6
↓
Notificación se marca como leída automáticamente
↓
Frontend navega a enlace_detalle (/canjes/42, /historial-puntos, etc.)
```

### Flujo 2: Usuario Marca Todas Como Leídas

```
PATCH /api/notificaciones/leer-todas
↓
Response: { mensaje: "...", cantidad_actualizadas: 12 }
↓
Frontend refresca el badge (ahora muestra 0)
```

### Flujo 3: Usuario Verifica Conteo Rápido

```
GET /api/notificaciones/no-leidas/contar
↓
Response: { cantidad: 3 }
↓
Frontend muestra badge con "3"
```

---

## 📊 Ejemplos de Filtrado

### Filtrar por Tipo

```http
GET /api/notificaciones?tipo=puntos_ganados
```

Devuelve solo notificaciones de tipo `puntos_ganados`.

### Filtrar por Estado

```http
GET /api/notificaciones?estado=no_leida
```

Devuelve solo notificaciones no leídas.

### Filtrar por Tipo y Estado

```http
GET /api/notificaciones?tipo=canje_creado&estado=no_leida
```

Devuelve canjes creados que no han sido leídos.

### Paginación

```http
GET /api/notificaciones?page=2&limit=10
```

Segunda página con 10 notificaciones por página.

---

## 🎨 Ejemplo de Renderizado en Frontend

### React Component Example

```jsx
import React, { useState, useEffect } from 'react';

function NotificationsCenter() {
  const [notificaciones, setNotificaciones] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    fetchNotificaciones();
    fetchNoLeidas();
  }, []);

  const fetchNotificaciones = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notificaciones?page=1&limit=20', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = await res.json();
      setNotificaciones(data.notificaciones);
    } finally {
      setLoading(false);
    }
  };

  const fetchNoLeidas = async () => {
    const res = await fetch('/api/notificaciones/no-leidas/contar', {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await res.json();
    setNoLeidas(data.cantidad);
  };

  const handleClickNotificacion = async (notificacion) => {
    // Obtener detalle (se marca como leída automáticamente)
    const res = await fetch(`/api/notificaciones/${notificacion.id}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const detail = await res.json();

    // Navegar al enlace de detalle
    if (detail.enlace_detalle) {
      window.location.href = detail.enlace_detalle;
    }

    // Refrescar conteo
    fetchNoLeidas();
  };

  const handleMarcarTodasLeidas = async () => {
    await fetch('/api/notificaciones/leer-todas', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    fetchNotificaciones();
    fetchNoLeidas();
  };

  return (
    <div className="notifications-center">
      <div className="header">
        <h2>Notificaciones {noLeidas > 0 && <span className="badge">{noLeidas}</span>}</h2>
        {noLeidas > 0 && (
          <button onClick={handleMarcarTodasLeidas} className="btn-secondary">
            Marcar todas como leídas
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading">Cargando...</div>
      ) : notificaciones.length === 0 ? (
        <div className="empty">No tienes notificaciones</div>
      ) : (
        <div className="notifications-list">
          {notificaciones.map(n => (
            <div
              key={n.id}
              className={`notification-item ${n.estado === 'no_leida' ? 'unread' : ''} color-${colorMap[n.tipo]}`}
              onClick={() => handleClickNotificacion(n)}
            >
              <div className="icon">{iconMap[n.tipo]}</div>
              <div className="content">
                <h3>{n.titulo}</h3>
                <p>{n.descripcion}</p>
                <small>{new Date(n.fecha_creacion).toLocaleString()}</small>
              </div>
              {n.estado === 'no_leida' && <div className="dot"></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NotificationsCenter;
```

---

## 🚀 Recomendaciones de Implementación en Frontend

### 1. Badge en Header
```jsx
<header>
  <h1>Mi App</h1>
  <NotificationBell count={noLeidas} onClick={() => openNotificationsModal()} />
</header>
```

### 2. Auto-refresh cada 30 segundos
```jsx
useEffect(() => {
  const interval = setInterval(fetchNotificaciones, 30000);
  return () => clearInterval(interval);
}, []);
```

### 3. Toast Notifications (Opcional)
Cuando llegue una notificación en tiempo real (si implementas WebSockets).

### 4. Historial Persistente
Guardar notificaciones en localStorage para no perder contexto durante sesión.

### 5. Acceso Rápido
Notificaciones no leídas en dropdown del header con enlace a "Ver todas".

---

## ✅ Checklist de Pruebas

- [ ] Crear canje → notificación de `canje_creado`
- [ ] Marcar canje como entregado → notificación de `canje_entregado`
- [ ] Cancelar canje → notificación de `canje_cancelado`
- [ ] Devolver canje → notificación de `canje_devuelto`
- [ ] Seguir canal en Kick → notificación de `puntos_ganados`
- [ ] Canjear recompensa → notificación de `puntos_ganados`
- [ ] Suscribirse → notificación de `puntos_ganados`
- [ ] Recibir suscripción regalada → notificación de `sub_regalada`
- [ ] Enviar kicks → notificación de `puntos_ganados`
- [ ] Listar notificaciones paginadas → funciona correctamente
- [ ] Marcar como leída → campo `fecha_lectura` se actualiza
- [ ] Marcar todas como leídas → todas tienen `estado: leida`
- [ ] Eliminar → `deleted_at` se establece (soft delete)
- [ ] Contar no leídas → número correcto

