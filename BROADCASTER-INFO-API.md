# 📡 API de Información del Broadcaster

## 🎯 Descripción

Sistema de endpoints públicos para obtener información en tiempo real del broadcaster principal (Luisardito), incluyendo estado del stream, metadata, estadísticas y más.

## 🚀 Endpoints Disponibles

### 1. Información Completa del Broadcaster

**GET** `/api/broadcaster/info`

Obtiene toda la información disponible del broadcaster principal.

#### ✅ Características
- ✅ **Público** - No requiere autenticación
- ✅ Información en tiempo real desde Redis
- ✅ Estado del stream (online/offline)
- ✅ Metadata del stream (título, categoría, etc.)
- ✅ Tiempo en vivo o última vez en vivo
- ✅ Información del canal

#### 📦 Respuesta Ejemplo (Stream OFFLINE)

```json
{
  "success": true,
  "data": {
    "username": "Luisardito",
    "user_id": "33112734",
    "profile_picture": "/logo2.jpg",
    "channel_url": "https://kick.com/luisardito",
    "is_verified": true,
    "stream": {
      "is_live": false,
      "status": "offline",
      "title": null,
      "category": null,
      "category_id": null,
      "language": "es",
      "has_mature_content": false,
      "started_at": null,
      "uptime_minutes": null,
      "last_live_ago": "Hace 2 horas"
    },
    "metadata": {
      "last_status_update": "2025-12-06T18:30:00.000Z",
      "last_metadata_update": "2025-12-06T18:29:55.000Z",
      "data_updated_at": "2025-12-06T20:57:06.710Z"
    }
  }
}
```

#### 📦 Respuesta Ejemplo (Stream ONLINE)

```json
{
  "success": true,
  "data": {
    "username": "Luisardito",
    "user_id": "33112734",
    "profile_picture": "/logo2.jpg",
    "channel_url": "https://kick.com/luisardito",
    "is_verified": true,
    "stream": {
      "is_live": true,
      "status": "online",
      "title": "🎮 JUGANDO CON LA COMUNIDAD | !discord !puntos",
      "category": "Grand Theft Auto V",
      "category_id": 19577,
      "language": "es",
      "has_mature_content": false,
      "started_at": "2025-12-06T19:00:00.000Z",
      "uptime_minutes": 117,
      "last_live_ago": null
    },
    "metadata": {
      "last_status_update": "2025-12-06T19:00:05.000Z",
      "last_metadata_update": "2025-12-06T20:55:00.000Z",
      "data_updated_at": "2025-12-06T20:57:06.710Z"
    }
  }
}
```

---

### 2. Estado Básico del Stream

**GET** `/api/broadcaster/status`

Obtiene solo el estado del stream (más ligero y rápido).

#### ✅ Características
- ✅ **Público** - No requiere autenticación
- ✅ Respuesta ultra rápida
- ✅ Ideal para polling frecuente
- ✅ Menor carga en el servidor

#### 📦 Respuesta Ejemplo

```json
{
  "success": true,
  "data": {
    "is_live": true,
    "status": "online",
    "checked_at": "2025-12-06T20:57:06.710Z"
  }
}
```

---

## 🎨 Uso en el Frontend

### Ejemplo con Fetch API

```javascript
// Obtener información completa
async function getBroadcasterInfo() {
  try {
    const response = await fetch('http://localhost:3001/api/broadcaster/info');
    const { success, data } = await response.json();
    
    if (success) {
      console.log('Broadcaster:', data.username);
      console.log('Estado:', data.stream.is_live ? 'ONLINE' : 'OFFLINE');
      
      if (data.stream.is_live) {
        console.log('Título:', data.stream.title);
        console.log('Categoría:', data.stream.category);
        console.log('Tiempo en vivo:', data.stream.uptime_minutes, 'minutos');
      } else {
        console.log('Última vez en vivo:', data.stream.last_live_ago);
      }
    }
  } catch (error) {
    console.error('Error obteniendo info del broadcaster:', error);
  }
}

// Polling para verificar estado (cada 30 segundos)
setInterval(async () => {
  const response = await fetch('http://localhost:3001/api/broadcaster/status');
  const { success, data } = await response.json();
  
  if (success) {
    console.log('Estado actual:', data.status);
  }
}, 30000);
```

### Ejemplo con Axios

```javascript
import axios from 'axios';

const API_URL = 'http://localhost:3001/api/broadcaster';

// Obtener información completa
export const getBroadcasterInfo = async () => {
  try {
    const { data } = await axios.get(`${API_URL}/info`);
    return data.data; // Retorna directamente el objeto con la info
  } catch (error) {
    console.error('Error obteniendo broadcaster info:', error);
    throw error;
  }
};

// Obtener solo el estado
export const getStreamStatus = async () => {
  try {
    const { data } = await axios.get(`${API_URL}/status`);
    return data.data;
  } catch (error) {
    console.error('Error obteniendo stream status:', error);
    throw error;
  }
};
```

### Ejemplo con React Hook

```jsx
import { useState, useEffect } from 'react';

function useBroadcasterInfo(pollInterval = 30000) {
  const [broadcasterInfo, setBroadcasterInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBroadcasterInfo = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/broadcaster/info');
        const { success, data } = await response.json();
        
        if (success) {
          setBroadcasterInfo(data);
          setError(null);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    // Fetch inicial
    fetchBroadcasterInfo();

    // Polling
    const interval = setInterval(fetchBroadcasterInfo, pollInterval);

    return () => clearInterval(interval);
  }, [pollInterval]);

  return { broadcasterInfo, loading, error };
}

// Uso en componente
function BroadcasterPanel() {
  const { broadcasterInfo, loading, error } = useBroadcasterInfo(30000);

  if (loading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="broadcaster-panel">
      <img src={broadcasterInfo.profile_picture} alt={broadcasterInfo.username} />
      <h2>{broadcasterInfo.username}</h2>
      
      {broadcasterInfo.stream.is_live ? (
        <div className="online-badge">
          <span className="badge-green">●</span> ONLINE
          <p>En vivo hace {broadcasterInfo.stream.uptime_minutes} minutos</p>
          <p>{broadcasterInfo.stream.title}</p>
        </div>
      ) : (
        <div className="offline-badge">
          <span className="badge-gray">●</span> OFFLINE
          <p>{broadcasterInfo.stream.last_live_ago}</p>
        </div>
      )}
      
      <a href={broadcasterInfo.channel_url} target="_blank" rel="noopener noreferrer">
        Ver canal
      </a>
    </div>
  );
}
```

---

## 📊 Campos de Respuesta

### Objeto `data`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `username` | `string` | Nombre de usuario del broadcaster |
| `user_id` | `string` | ID único del broadcaster en Kick |
| `profile_picture` | `string` | URL de la foto de perfil |
| `channel_url` | `string` | URL del canal en Kick |
| `is_verified` | `boolean` | Si el broadcaster está verificado |
| `stream` | `object` | Objeto con información del stream |
| `metadata` | `object` | Objeto con timestamps de actualización |

### Objeto `stream`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `is_live` | `boolean` | Si el stream está en vivo |
| `status` | `string` | Estado: `"online"`, `"offline"` o `"unknown"` |
| `title` | `string\|null` | Título del stream (solo cuando está online) |
| `category` | `string\|null` | Categoría/juego del stream |
| `category_id` | `number\|null` | ID de la categoría |
| `language` | `string` | Idioma del stream (default: `"es"`) |
| `has_mature_content` | `boolean` | Si el stream tiene contenido para adultos |
| `started_at` | `string\|null` | ISO timestamp de cuando empezó el stream |
| `uptime_minutes` | `number\|null` | Minutos que lleva en vivo (solo cuando está online) |
| `last_live_ago` | `string\|null` | Texto legible de cuándo fue la última vez en vivo |

### Objeto `metadata`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `last_status_update` | `string\|null` | ISO timestamp de última actualización de estado |
| `last_metadata_update` | `string\|null` | ISO timestamp de última actualización de metadata |
| `data_updated_at` | `string` | ISO timestamp de cuando se generó esta respuesta |

---

## 🎯 Casos de Uso

### Panel de Broadcaster en Homepage

Muestra información del broadcaster con estado en tiempo real:
- Foto de perfil
- Nombre y verificación
- Badge de estado (ONLINE/OFFLINE)
- Información del stream actual
- Última vez en vivo

### Notificaciones de Stream

Detecta cuando el broadcaster va en vivo:
```javascript
let wasLive = false;

setInterval(async () => {
  const { is_live } = await getStreamStatus();
  
  if (is_live && !wasLive) {
    // ¡Stream acaba de empezar!
    showNotification('¡Luisardito está EN VIVO!');
  }
  
  wasLive = is_live;
}, 30000);
```

### Estadísticas en Vivo

Muestra estadísticas del stream actual:
- Tiempo en vivo
- Categoría actual
- Título del stream

---

## 🔄 Actualización de Datos

Los datos se actualizan automáticamente mediante webhooks de Kick:

- **Estado (online/offline)**: Webhook `livestream.status.updated`
- **Metadata (título, categoría)**: Webhook `livestream.metadata.updated`
- **Almacenamiento**: Redis (tiempo real)

### Frecuencia Recomendada de Polling

- **Información completa**: Cada 30-60 segundos
- **Estado básico**: Cada 15-30 segundos
- **Detección de "ir en vivo"**: Cada 10-15 segundos

---

## ⚡ Rendimiento

- ✅ **Sin autenticación requerida** - Acceso instantáneo
- ✅ **Datos desde Redis** - Latencia < 5ms
- ✅ **Cache interno** - Respuestas ultra rápidas
- ✅ **Endpoint ligero** (`/status`) para polling frecuente

---

## 🛠️ Troubleshooting

### El estado siempre muestra "offline"

- Verificar que los webhooks de Kick estén configurados correctamente
- Revisar logs del backend para eventos `livestream.status.updated`
- Verificar conexión a Redis

### Los datos no se actualizan

- Verificar que el polling está activo en el frontend
- Verificar que el backend está recibiendo webhooks
- Revisar logs: `docker-compose logs -f api`

### Error 500 en el endpoint

- Verificar conexión a Redis
- Revisar logs del servidor
- Verificar que la configuración de `KICK_BROADCASTER_ID` está correcta

---

## 📝 Notas Técnicas

1. **Persistencia de datos**: Los datos del stream se almacenan en Redis y se actualizan en tiempo real mediante webhooks.

2. **Fallback**: Si hay algún error, el endpoint retorna información básica del broadcaster con estado "unknown".

3. **Formato de fechas**: Todas las fechas están en formato ISO 8601 (UTC).

4. **CORS**: El endpoint está configurado con CORS abierto para uso desde cualquier dominio.

---

## 🚀 Próximas Mejoras

- [ ] Agregar contador de espectadores (viewers)
- [ ] Agregar contador de seguidores
- [ ] Agregar thumbnail del stream en vivo
- [ ] Cache de respuestas con TTL corto
- [ ] WebSocket para notificaciones en tiempo real
- [ ] Historial de streams recientes

---

**Creado**: 6 de diciembre de 2025  
**Versión**: 1.0.0  
**Estado**: ✅ Producción
