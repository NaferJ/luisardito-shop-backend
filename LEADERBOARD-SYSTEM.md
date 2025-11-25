# 🏆 Sistema de Leaderboard - Documentación

## Descripción General

Sistema completo de tabla de clasificación (leaderboard) que permite mostrar rankings de usuarios basados en puntos, con indicadores visuales de cambios de posición a lo largo del tiempo.

## Características

✅ **Ranking en tiempo real** - Basado en los puntos actuales de cada usuario  
✅ **Indicadores de cambio** - Flechas verdes (↑) para subidas, rojas (↓) para bajadas  
✅ **Histórico de posiciones** - Seguimiento de la evolución de cada usuario  
✅ **Snapshots automáticos** - Capturas periódicas del ranking para comparaciones  
✅ **Alto rendimiento** - Consultas optimizadas con índices de base de datos  
✅ **Paginación** - Soporte para listas largas de usuarios  
✅ **Estadísticas** - Métricas generales del sistema de puntos  

---

## 🎯 Endpoints Disponibles

### 1. Obtener Leaderboard Completo

**Endpoint:** `GET /api/leaderboard`

**Descripción:** Obtiene el ranking de usuarios con indicadores de cambio de posición.

**Query Parameters:**
- `limit` (opcional, default: 100) - Cantidad de usuarios a retornar (máx: 500)
- `offset` (opcional, default: 0) - Offset para paginación
- `userId` (opcional) - ID de un usuario específico para incluir en la respuesta

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "usuario_id": 42,
      "nickname": "Luisardito",
      "puntos": 15000,
      "position": 1,
      "position_change": 2,
      "change_indicator": "up",
      "previous_position": 3,
      "previous_points": 14500,
      "is_vip": true,
      "kick_data": {
        "profile_pic": "https://...",
        "username": "luisardito"
      }
    },
    {
      "usuario_id": 17,
      "nickname": "UsuarioEjemplo",
      "puntos": 14800,
      "position": 2,
      "position_change": 0,
      "change_indicator": "neutral",
      "previous_position": 2,
      "previous_points": 14700,
      "is_vip": false,
      "kick_data": null
    },
    {
      "usuario_id": 99,
      "nickname": "NuevoUsuario",
      "puntos": 14500,
      "position": 3,
      "position_change": 0,
      "change_indicator": "new",
      "previous_position": null,
      "previous_points": null,
      "is_vip": false,
      "kick_data": null
    }
  ],
  "meta": {
    "total": 1250,
    "limit": 100,
    "offset": 0,
    "last_update": "2025-01-28T15:30:00.000Z"
  },
  "user_position": null
}
```

**Valores de `change_indicator`:**
- `"up"` - El usuario subió posiciones (muestra flecha verde ↑)
- `"down"` - El usuario bajó posiciones (muestra flecha roja ↓)
- `"neutral"` - El usuario mantuvo su posición (sin flecha o guión -)
- `"new"` - Usuario nuevo en el ranking (muestra badge "NUEVO" o estrella ⭐)

**Ejemplo de Uso (JavaScript):**
```javascript
// Obtener top 50
const response = await fetch('/api/leaderboard?limit=50&offset=0');
const data = await response.json();

// Renderizar en el frontend
data.data.forEach(user => {
  let indicator = '';
  if (user.change_indicator === 'up') {
    indicator = `<span class="text-green-500">↑${user.position_change}</span>`;
  } else if (user.change_indicator === 'down') {
    indicator = `<span class="text-red-500">↓${user.position_change}</span>`;
  } else if (user.change_indicator === 'new') {
    indicator = `<span class="text-yellow-500">⭐ NUEVO</span>`;
  }
  
  console.log(`${user.position}. ${user.nickname} - ${user.puntos} pts ${indicator}`);
});
```

---

### 2. Obtener Top 10

**Endpoint:** `GET /api/leaderboard/top10`

**Descripción:** Endpoint optimizado para obtener rápidamente los 10 mejores usuarios.

**Sin parámetros requeridos**

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "usuario_id": 42,
      "nickname": "Luisardito",
      "puntos": 15000,
      "position": 1,
      "position_change": 0,
      "change_indicator": "neutral",
      "is_vip": true
    }
    // ... hasta 10 usuarios
  ],
  "meta": {
    "last_update": "2025-01-28T15:30:00.000Z"
  }
}
```

---

### 3. Obtener Mi Posición (Usuario Autenticado)

**Endpoint:** `GET /api/leaderboard/me`

**Descripción:** Obtiene la posición en el ranking del usuario autenticado.

**Headers Requeridos:**
- `Authorization: Bearer <token>` (JWT del usuario autenticado)

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "usuario_id": 123,
    "nickname": "MiUsuario",
    "puntos": 8500,
    "position": 45,
    "position_change": 3,
    "change_indicator": "up",
    "previous_position": 48,
    "previous_points": 8200,
    "is_vip": false
  }
}
```

---

### 4. Obtener Historial de Usuario

**Endpoint:** `GET /api/leaderboard/user/:userId/history`

**Descripción:** Obtiene el historial de posiciones de un usuario específico.

**Path Parameters:**
- `userId` (requerido) - ID del usuario

**Query Parameters:**
- `days` (opcional, default: 7, máx: 90) - Días de histórico a retornar

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "history": [
    {
      "position": 50,
      "puntos": 7500,
      "snapshot_date": "2025-01-21T12:00:00.000Z"
    },
    {
      "position": 48,
      "puntos": 8000,
      "snapshot_date": "2025-01-22T18:00:00.000Z"
    },
    {
      "position": 45,
      "puntos": 8500,
      "snapshot_date": "2025-01-28T15:30:00.000Z"
    }
  ]
}
```

**Ejemplo de Uso (Gráfico):**
```javascript
// Renderizar gráfico con Chart.js
const response = await fetch('/api/leaderboard/user/123/history?days=30');
const { history } = await response.json();

const chartData = {
  labels: history.map(h => new Date(h.snapshot_date).toLocaleDateString()),
  datasets: [{
    label: 'Posición en el Ranking',
    data: history.map(h => h.position),
    borderColor: 'rgb(75, 192, 192)',
    tension: 0.1
  }]
};

// Nota: Invertir el eje Y porque posición 1 es mejor que 100
```

---

### 5. Obtener Estadísticas Generales

**Endpoint:** `GET /api/leaderboard/stats`

**Descripción:** Obtiene estadísticas generales del sistema de puntos.

**Sin parámetros requeridos**

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "stats": {
    "total_users": 1250,
    "total_points": 1850000,
    "average_points": 1480,
    "top_user": {
      "nickname": "Luisardito",
      "puntos": 15000
    },
    "vip_users": 45
  }
}
```

---

### 6. Crear Snapshot Manual (Admin)

**Endpoint:** `POST /api/leaderboard/snapshot`

**Descripción:** Crea un snapshot manual del leaderboard actual.

**Permisos Requeridos:** `gestionar_usuarios` (admin)

**Headers Requeridos:**
- `Authorization: Bearer <token>` (JWT con permisos de admin)

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "snapshot_date": "2025-01-28T15:30:00.000Z",
  "users_count": 1250
}
```

---

### 7. Limpiar Snapshots Antiguos (Admin)

**Endpoint:** `DELETE /api/leaderboard/snapshots/old`

**Descripción:** Elimina snapshots antiguos para optimizar la base de datos.

**Permisos Requeridos:** `gestionar_usuarios` (admin)

**Query Parameters:**
- `days` (opcional, default: 30, mín: 7) - Días de histórico a mantener

**Headers Requeridos:**
- `Authorization: Bearer <token>` (JWT con permisos de admin)

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "deleted_count": 15000
}
```

---

## 🔧 Configuración del Sistema

### Variables de Entorno

Agrega estas variables a tu archivo `.env`:

```bash
# Intervalo de snapshots automáticos (en horas)
LEADERBOARD_SNAPSHOT_INTERVAL_HOURS=6

# Días de histórico a mantener
LEADERBOARD_CLEANUP_DAYS=30
```

### Valores Recomendados

- **Producción:** `LEADERBOARD_SNAPSHOT_INTERVAL_HOURS=6` (4 snapshots al día)
- **Desarrollo/Testing:** `LEADERBOARD_SNAPSHOT_INTERVAL_HOURS=1` (cada hora)
- **Histórico:** `LEADERBOARD_CLEANUP_DAYS=30` (mantener 1 mes de datos)

---

## 📊 Implementación en Frontend

### Ejemplo Completo con React

```jsx
import { useState, useEffect } from 'react';

function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myPosition, setMyPosition] = useState(null);

  useEffect(() => {
    fetchLeaderboard();
    fetchMyPosition();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard?limit=50');
      const data = await res.json();
      setLeaderboard(data.data);
    } catch (error) {
      console.error('Error al cargar leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyPosition = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/leaderboard/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setMyPosition(data.data);
    } catch (error) {
      console.error('Error al cargar mi posición:', error);
    }
  };

  const renderChangeIndicator = (user) => {
    switch (user.change_indicator) {
      case 'up':
        return (
          <span className="text-green-500 font-bold">
            ↑ {user.position_change}
          </span>
        );
      case 'down':
        return (
          <span className="text-red-500 font-bold">
            ↓ {user.position_change}
          </span>
        );
      case 'new':
        return (
          <span className="text-yellow-500 font-bold">⭐ NUEVO</span>
        );
      default:
        return <span className="text-gray-400">—</span>;
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="leaderboard-container">
      <h1>🏆 Tabla de Clasificación</h1>

      {/* Mi posición destacada */}
      {myPosition && (
        <div className="my-position-card">
          <h3>Tu Posición</h3>
          <div className="position-badge">#{myPosition.position}</div>
          <p>{myPosition.puntos} puntos</p>
          {renderChangeIndicator(myPosition)}
        </div>
      )}

      {/* Tabla del leaderboard */}
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Posición</th>
            <th>Usuario</th>
            <th>Puntos</th>
            <th>Cambio</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((user) => (
            <tr 
              key={user.usuario_id}
              className={user.usuario_id === myPosition?.usuario_id ? 'highlighted' : ''}
            >
              <td className="position">
                <span className={`position-badge ${
                  user.position === 1 ? 'gold' :
                  user.position === 2 ? 'silver' :
                  user.position === 3 ? 'bronze' : ''
                }`}>
                  {user.position}
                </span>
              </td>
              <td>
                <div className="user-info">
                  {user.kick_data?.profile_pic && (
                    <img 
                      src={user.kick_data.profile_pic} 
                      alt={user.nickname}
                      className="avatar"
                    />
                  )}
                  <span className="nickname">
                    {user.nickname}
                    {user.is_vip && <span className="vip-badge">VIP</span>}
                  </span>
                </div>
              </td>
              <td className="points">{user.puntos.toLocaleString()}</td>
              <td className="change">{renderChangeIndicator(user)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Leaderboard;
```

### CSS de Ejemplo

```css
.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
}

.leaderboard-table th,
.leaderboard-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.position-badge {
  display: inline-block;
  width: 32px;
  height: 32px;
  line-height: 32px;
  text-align: center;
  border-radius: 50%;
  font-weight: bold;
}

.position-badge.gold {
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: #000;
}

.position-badge.silver {
  background: linear-gradient(135deg, #C0C0C0, #808080);
  color: #000;
}

.position-badge.bronze {
  background: linear-gradient(135deg, #CD7F32, #8B4513);
  color: #fff;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.vip-badge {
  background: #FFD700;
  color: #000;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: bold;
  margin-left: 4px;
}

.highlighted {
  background-color: rgba(59, 130, 246, 0.1);
  border-left: 3px solid #3B82F6;
}

.my-position-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 24px;
  text-align: center;
}
```

---

## 🔄 Flujo del Sistema

### 1. Creación de Snapshots Automáticos

El sistema crea snapshots del ranking cada **6 horas** (configurable):

```
Hora 0:00 → Snapshot 1 (posiciones guardadas)
Hora 6:00 → Snapshot 2 (comparar con Snapshot 1)
Hora 12:00 → Snapshot 3 (comparar con Snapshot 2)
Hora 18:00 → Snapshot 4 (comparar con Snapshot 3)
```

### 2. Cálculo de Cambios de Posición

Cuando un usuario consulta el leaderboard:
1. Se obtiene el ranking actual (ordenado por puntos)
2. Se busca el último snapshot guardado
3. Se comparan las posiciones actuales vs. anteriores
4. Se calculan los indicadores (`up`, `down`, `neutral`, `new`)

### 3. Limpieza Automática

Una vez al día, el sistema elimina snapshots antiguos (>30 días) para optimizar la base de datos.

---

## 💡 Mejores Prácticas

### Para Frontend

1. **Caché Inteligente:** Cachea el leaderboard por 1-2 minutos en el cliente
2. **Lazy Loading:** Carga más usuarios solo cuando el usuario hace scroll
3. **Actualización Periódica:** Refresca el leaderboard cada 5-10 minutos
4. **Feedback Visual:** Anima las flechas de cambio para mayor impacto
5. **Placeholder/Skeleton:** Muestra un esqueleto mientras carga

### Para Backend

- Los snapshots se crean automáticamente, no requiere intervención manual
- Ajusta `LEADERBOARD_SNAPSHOT_INTERVAL_HOURS` según tu tráfico
- Monitorea el tamaño de la tabla `leaderboard_snapshots`

---

## 📈 Optimizaciones

### Índices de Base de Datos

El sistema incluye los siguientes índices optimizados:

```sql
-- Búsqueda rápida por usuario y fecha
idx_leaderboard_usuario_date (usuario_id, snapshot_date)

-- Búsqueda rápida por fecha de snapshot
idx_leaderboard_snapshot_date (snapshot_date)

-- Búsqueda rápida por posición y fecha
idx_leaderboard_position_date (position, snapshot_date)
```

### Rendimiento Esperado

- **Consulta de Top 100:** < 50ms
- **Consulta de posición específica:** < 30ms
- **Creación de snapshot:** < 2s (1000 usuarios)
- **Limpieza de snapshots:** < 5s (10,000+ registros)

---

## 🐛 Troubleshooting

### Problema: Los indicadores siempre muestran "new"

**Solución:** No hay snapshots guardados. Ejecuta manualmente:
```bash
curl -X POST http://localhost:3001/api/leaderboard/snapshot \
  -H "Authorization: Bearer <admin-token>"
```

### Problema: El leaderboard no se actualiza

**Verificación:** Revisa los logs del servidor:
```bash
docker-compose logs -f backend | grep LEADERBOARD-SNAPSHOT
```

### Problema: Tabla muy grande

**Solución:** Ajusta `LEADERBOARD_CLEANUP_DAYS` a un valor menor (ej: 14 días)

---

## 📝 Migración de Base de Datos

Para aplicar la migración:

```bash
# Si usas Docker
docker-compose exec backend npx sequelize-cli db:migrate

# Si es local
npx sequelize-cli db:migrate
```

La migración crea la tabla `leaderboard_snapshots` con todos los índices necesarios.

---

## 🎨 Ideas de Mejora para Frontend

1. **Medallas/Badges:** Top 3 con medallas especiales (🥇🥈🥉)
2. **Animaciones:** Transiciones suaves cuando cambian posiciones
3. **Filtros:** Por usuarios VIP, por rango de puntos, etc.
4. **Búsqueda:** Buscar usuarios específicos en el ranking
5. **Gráficos:** Mostrar evolución de posiciones en el tiempo
6. **Notificaciones:** Avisar cuando subes/bajas posiciones significativas
7. **Comparativas:** "Necesitas X puntos para llegar al top 10"
8. **Periodos:** Ver rankings históricos (esta semana, este mes, etc.)

---

## 📞 Soporte

Para reportar bugs o sugerir mejoras, contacta al equipo de desarrollo.

**Endpoints relacionados:**
- Sistema de puntos: `/api/usuarios/:id/puntos`
- Historial de puntos: `/api/historial-puntos`
- Configuración de puntos Kick: `/api/kick/points-config`

---

**¡El sistema está listo para usar! 🚀**