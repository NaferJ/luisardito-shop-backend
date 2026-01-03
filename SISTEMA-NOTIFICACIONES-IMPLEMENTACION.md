# 📬 Sistema de Notificaciones - Implementación Completa

## 📋 Resumen

Se ha implementado un sistema profesional de notificaciones transversal en el backend que notifica automáticamente a los usuarios sobre eventos importantes como:
- 🎁 Suscripciones regaladas
- 💰 Puntos ganados (por diversos eventos)
- 🛍️ Canjes creados, entregados, cancelados o devueltos
- ⚡ Otros eventos del sistema

## 📦 Archivos Creados

### 1. Modelo (`src/models/notificacion.model.js`)
Define la estructura de una notificación con campos:
- `id`: Identificador único
- `usuario_id`: Usuario destinatario
- `titulo`: Título de la notificación
- `descripcion`: Descripción detallada
- `tipo`: ENUM con tipos específicos (sub_regalada, puntos_ganados, canje_creado, etc.)
- `estado`: 'no_leida' o 'leida'
- `datos_relacionados`: JSON con contexto (producto, montos, usuario, etc.)
- `enlace_detalle`: URL relativa para navegar al detalle
- `fecha_lectura`: Timestamp cuando se marcó como leída
- `deleted_at`: Para soft deletes
- Timestamps: `fecha_creacion`, `fecha_actualizacion`

### 2. Migración (`migrations/20260103000001-create-notificaciones.js`)
Crea la tabla `notificaciones` con:
- Campos descritos arriba
- Índices en: `usuario_id`, `estado`, `tipo`, combinaciones
- Índice en `fecha_creacion` DESC para queries rápidas

### 3. Servicio (`src/services/notificacion.service.js`)
Clase `NotificacionService` con métodos:

#### Métodos Base
- `crear()`: Crea una notificación genérica
- `listar()`: Obtiene notificaciones del usuario (paginadas, filtradas)
- `obtenerDetalle()`: Obtiene una notificación específica
- `marcarComoLeida()`: Marca una como leída
- `marcarTodasComoLeidas()`: Marca todas como leídas
- `eliminar()`: Soft delete de notificación
- `contarNoLeidas()`: Cuenta no leídas

#### Métodos Específicos (facilitan creación de notificaciones tipadas)
- `crearNotificacionSubRegalada()`: Para suscripciones regaladas
- `crearNotificacionPuntosGanados()`: Para puntos ganados
- `crearNotificacionCanjeCreado()`: Cuando se crea un canje
- `crearNotificacionCanjeEntregado()`: Cuando se entrega
- `crearNotificacionCanjeCancelado()`: Cuando se cancela
- `crearNotificacionCanjeDevuelto()`: Cuando se devuelve

### 4. Controlador (`src/controllers/notificaciones.controller.js`)
Implementa rutas HTTP:
- `listar()`: GET /api/notificaciones
- `obtenerDetalle()`: GET /api/notificaciones/:id
- `marcarComoLeida()`: PATCH /api/notificaciones/:id/leido
- `marcarTodasComoLeidas()`: PATCH /api/notificaciones/leer-todas
- `eliminar()`: DELETE /api/notificaciones/:id
- `contarNoLeidas()`: GET /api/notificaciones/no-leidas/contar

### 5. Rutas (`src/routes/notificaciones.routes.js`)
Define endpoints con autenticación requerida:
```javascript
GET    /api/notificaciones                    // page, limit, tipo, estado
GET    /api/notificaciones/no-leidas/contar   // { cantidad }
GET    /api/notificaciones/:id                // detalle (marca leída automáticamente)
PATCH  /api/notificaciones/:id/leido          // marca como leída
PATCH  /api/notificaciones/leer-todas         // marca todas como leídas
DELETE /api/notificaciones/:id                // elimina (soft delete)
```

## 🔌 Integraciones Realizadas

### 1. Sistema de Canjes (`src/controllers/canjes.controller.js`)
Se agregaron notificaciones automáticas en:

- **`crear()`**: Cuando se crea un canje
  ```javascript
  NotificacionService.crearNotificacionCanjeCreado(usuarioId, {
    canje_id, nombre_producto, precio, promocion_aplicada
  }, transaction)
  ```

- **`actualizarEstado()`**: Cuando cambio a 'entregado' o 'cancelado'
  ```javascript
  if (estado === 'entregado') {
    NotificacionService.crearNotificacionCanjeEntregado(...)
  } else if (estado === 'cancelado') {
    NotificacionService.crearNotificacionCanjeCancelado(...)
  }
  ```

- **`devolverCanje()`**: Cuando se devuelve un canje
  ```javascript
  NotificacionService.crearNotificacionCanjeDevuelto(usuarioId, {
    canje_id, nombre_producto, puntos_devueltos, motivo
  }, transaction)
  ```

### 2. Webhook de Kick (`src/controllers/kickWebhook.controller.js`)
Se agregaron notificaciones para eventos de Kick:

- **Reward Redemption**: Cuando alguien canjea una recompensa
  ```javascript
  NotificacionService.crearNotificacionPuntosGanados(usuarioId, {
    cantidad: puntosAOtorgar,
    concepto: `Canje de recompensa: ${titulo}`,
    tipo_evento: 'channel.reward.redemption.updated'
  }, transaction)
  ```

- **Channel Follow**: Primer follow al canal
  ```javascript
  NotificacionService.crearNotificacionPuntosGanados(usuarioId, {
    cantidad: pointsToAward,
    concepto: 'Primer follow al canal',
    tipo_evento: 'channel.followed'
  })
  ```

- **New Subscription**: Nueva suscripción
  ```javascript
  NotificacionService.crearNotificacionPuntosGanados(usuarioId, {
    cantidad: pointsToAward,
    concepto: `Nueva suscripción (${duration} meses)`,
    tipo_evento: 'channel.subscription.new',
    duracion_meses: duration
  })
  ```

- **Kicks Gifted**: Regalos de kicks
  ```javascript
  NotificacionService.crearNotificacionPuntosGanados(usuarioId, {
    cantidad: pointsToAward,
    concepto: `Regalo de ${kickAmount} kicks`,
    tipo_evento: 'kicks.gifted',
    kick_amount: kickAmount,
    gift_name: giftName
  }, transaction)
  ```

- **Subscription Gifts - Gifter**: Quien regala suscripciones
  ```javascript
  NotificacionService.crearNotificacionPuntosGanados(gifterUsuario.id, {
    cantidad: totalPoints,
    concepto: `Regalaste ${giftees.length} suscripción(es)`,
    tipo_evento: 'channel.subscription.gifts',
    gifts_count: giftees.length
  })
  ```

- **Subscription Gifts - Giftee**: Quien recibe la suscripción
  ```javascript
  NotificacionService.crearNotificacionSubRegalada(gifteeUsuario.id, {
    regalador_username: gifter.is_anonymous ? "Anónimo" : gifter.username,
    monto_subscription: 1,
    puntos_otorgados: pointsForGiftee,
    expires_at: expiresAt
  })
  ```

### 3. Modelo de Notificación en Index
Se agregó al archivo `src/models/index.js`:
- Import: `const Notificacion = require("./notificacion.model")`
- Asociación: `Usuario.hasMany(Notificacion)` y `Notificacion.belongsTo(Usuario)`
- Export: `Notificacion` en module.exports

### 4. Rutas en App
Se agregó al archivo `app.js`:
```javascript
const notificacionesRoutes = require("./src/routes/notificaciones.routes");
// ...
app.use("/api/notificaciones", notificacionesRoutes);
```

## 🚀 Cómo Usar

### Instalación
```bash
# 1. Ejecutar la migración
npm run migrate

# O si usas sequelize-cli directamente
npx sequelize-cli db:migrate
```

### Endpoints de API

#### Listar notificaciones
```http
GET /api/notificaciones?page=1&limit=20&tipo=puntos_ganados&estado=no_leida
Authorization: Bearer <token>

Response:
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
      "fecha_creacion": "2026-01-03T10:30:45.000Z"
    }
  ]
}
```

#### Obtener detalle (y marcar como leída)
```http
GET /api/notificaciones/1
Authorization: Bearer <token>

Response: (La notificación se marca como leída automáticamente)
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
  "fecha_creacion": "2026-01-03T10:30:45.000Z"
}
```

#### Marcar como leída
```http
PATCH /api/notificaciones/1/leido
Authorization: Bearer <token>

Response:
{
  "mensaje": "Notificación marcada como leída",
  "notificacion": { ... }
}
```

#### Marcar todas como leídas
```http
PATCH /api/notificaciones/leer-todas
Authorization: Bearer <token>

Response:
{
  "mensaje": "Todas las notificaciones marcadas como leídas",
  "cantidad_actualizadas": 12
}
```

#### Contar no leídas
```http
GET /api/notificaciones/no-leidas/contar
Authorization: Bearer <token>

Response:
{
  "cantidad": 3
}
```

#### Eliminar una notificación
```http
DELETE /api/notificaciones/1
Authorization: Bearer <token>

Response:
{
  "id": 1,
  "mensaje": "Notificación eliminada"
}
```

## 📊 Tipos de Notificaciones

| Tipo | Descripción | Enlace | Datos |
|------|-------------|--------|-------|
| `sub_regalada` | Recibió suscripción regalada | `/suscripciones` | regalador, monto, puntos |
| `puntos_ganados` | Ganó puntos (múltiples causas) | `/historial-puntos` | cantidad, concepto, evento |
| `canje_creado` | Canje creado exitosamente | `/canjes/{id}` | producto, precio, promoción |
| `canje_entregado` | Estado cambió a entregado | `/canjes/{id}` | producto, estado |
| `canje_cancelado` | Estado cambió a cancelado | `/canjes/{id}` | producto, motivo |
| `canje_devuelto` | Estado cambió a devuelto | `/canjes/{id}` | producto, puntos devueltos |
| `historial_evento` | Evento en historial | `/historial-puntos` | evento específico |
| `sistema` | Notificación del sistema | N/A | mensajes generales |

## 🎨 Recomendaciones para Frontend

### 1. Badge de No Leídas
Mostrar badge con contador:
```javascript
const { cantidad } = await fetch('/api/notificaciones/no-leidas/contar').then(r => r.json());
// Mostrar badge con "cantidad"
```

### 2. Listar en Centro de Notificaciones
```javascript
const notificaciones = await fetch(
  '/api/notificaciones?page=1&limit=20'
).then(r => r.json());

notificaciones.notificaciones.forEach(n => {
  // Mostrar con:
  // - Icono según tipo
  // - Título y descripción
  // - Timestamp (fecha_creacion)
  // - Estado visual (gris si leída, resaltado si no)
});
```

### 3. Al Hacer Click
```javascript
// Obtener detalle (se marca como leída automáticamente)
const notificacion = await fetch(`/api/notificaciones/${id}`).then(r => r.json());

// Navegar a enlace_detalle
window.location.href = notificacion.enlace_detalle;
```

### 4. Iconos Sugeridos
```javascript
const iconos = {
  'sub_regalada': '🎁',
  'puntos_ganados': '💰',
  'canje_creado': '🛍️',
  'canje_entregado': '✅',
  'canje_cancelado': '❌',
  'canje_devuelto': '↩️',
  'historial_evento': '📝',
  'sistema': '⚡'
};
```

### 5. Colores Sugeridos
```javascript
const colores = {
  'sub_regalada': 'success',      // verde
  'puntos_ganados': 'info',       // azul
  'canje_creado': 'primary',      // principal
  'canje_entregado': 'success',   // verde
  'canje_cancelado': 'danger',    // rojo
  'canje_devuelto': 'warning',    // naranja
  'historial_evento': 'secondary', // gris
  'sistema': 'info'               // azul
};
```

## 🔒 Seguridad

- ✅ Todas las rutas requieren autenticación (`authRequired`)
- ✅ Los usuarios solo ven sus propias notificaciones
- ✅ Soft deletes preservan datos para auditoría
- ✅ Transacciones ACID en operaciones de base de datos
- ✅ Validación de límites en paginación

## 🚦 Testing

### Test Manual - Crear Notificación
```bash
# Desde otra ruta que cree un canje
curl -X POST http://localhost:3000/api/canjes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"producto_id": 1}'

# Debería recibir notificación de canje_creado
```

### Test Manual - Listar Notificaciones
```bash
curl http://localhost:3000/api/notificaciones \
  -H "Authorization: Bearer <token>"
```

### Test Manual - Marcar Como Leída
```bash
curl -X PATCH http://localhost:3000/api/notificaciones/1/leido \
  -H "Authorization: Bearer <token>"
```

## 📈 Próximas Mejoras (Opcional)

1. **WebSockets/SSE**: Para notificaciones en tiempo real
2. **Email/SMS**: Notificaciones por otros canales
3. **Preferencias de Usuario**: Permitir activar/desactivar tipos
4. **Notificaciones Agrupadas**: Agrupar notificaciones similares
5. **Filtros Avanzados**: Por fecha, rango de puntos, etc.
6. **Archivado de Notificaciones**: Distinción entre eliminadas y archivadas

## ✨ Conclusión

Sistema de notificaciones completamente integrado y listo para usar. Todos los eventos importantes del sistema crean automáticamente notificaciones profesionales y contextuales para el usuario.

