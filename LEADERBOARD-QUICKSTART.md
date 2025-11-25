# 🏆 Leaderboard - Guía de Inicio Rápido

## ✅ Instalación Completada

El sistema de leaderboard ha sido instalado exitosamente en tu backend. Todos los archivos necesarios han sido creados.

---

## 📦 Archivos Creados

### Modelos
- `src/models/leaderboardSnapshot.model.js` - Modelo para snapshots del ranking

### Servicios
- `src/services/leaderboard.service.js` - Lógica de negocio del leaderboard
- `src/services/leaderboardSnapshot.task.js` - Tarea programada para snapshots automáticos

### Controladores y Rutas
- `src/controllers/leaderboard.controller.js` - Controladores de los endpoints
- `src/routes/leaderboard.routes.js` - Definición de rutas

### Migraciones
- `migrations/20250128000001-create-leaderboard-snapshots.js` - Migración de base de datos

### Documentación
- `LEADERBOARD-SYSTEM.md` - Documentación completa del sistema
- `test-leaderboard.js` - Script de prueba

---

## 🚀 Pasos para Activar

### 1. Ejecutar la Migración

Si usas **Docker**:
```bash
docker-compose exec backend npx sequelize-cli db:migrate
```

Si es **local**:
```bash
npx sequelize-cli db:migrate
```

### 2. Reiniciar el Servidor

El sistema se activa automáticamente al reiniciar:

**Docker:**
```bash
docker-compose restart backend
```

**Local:**
```bash
npm start
```

### 3. Verificar que Funciona

Verifica los logs del servidor, deberías ver:
```
🚀 [LEADERBOARD-SNAPSHOT] Iniciando tarea programada (cada 6 horas)
📸 [LEADERBOARD-SNAPSHOT] Iniciando snapshot del leaderboard...
✅ [LEADERBOARD-SNAPSHOT] Snapshot creado: X usuarios registrados
```

---

## 🧪 Probar el Sistema

### Opción 1: Script de Prueba (Recomendado)

```bash
node test-leaderboard.js
```

Este script muestra:
- Top 10 del leaderboard
- Estadísticas generales
- Historial de usuarios
- Análisis de cambios

### Opción 2: cURL Manual

```bash
# Obtener top 10
curl http://localhost:3001/api/leaderboard/top10

# Obtener leaderboard completo
curl http://localhost:3001/api/leaderboard?limit=50

# Obtener estadísticas
curl http://localhost:3001/api/leaderboard/stats
```

### Opción 3: Navegador

Abre en tu navegador:
- http://localhost:3001/api/leaderboard/top10
- http://localhost:3001/api/leaderboard/stats

---

## 📊 Endpoints Principales para Frontend

### 1. Obtener Leaderboard
```
GET /api/leaderboard?limit=50&offset=0
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "usuario_id": 1,
      "nickname": "Usuario1",
      "puntos": 5000,
      "position": 1,
      "position_change": 2,
      "change_indicator": "up",  // "up", "down", "neutral", "new"
      "is_vip": true,
      "kick_data": { ... }
    }
  ],
  "meta": {
    "total": 1250,
    "limit": 50,
    "offset": 0,
    "last_update": "2025-01-28T15:30:00Z"
  }
}
```

### 2. Obtener Top 10 (rápido)
```
GET /api/leaderboard/top10
```

### 3. Obtener Mi Posición (requiere auth)
```
GET /api/leaderboard/me
Headers: Authorization: Bearer <token>
```

### 4. Obtener Estadísticas
```
GET /api/leaderboard/stats
```

---

## 🎨 Cómo Mostrar las Flechas en el Frontend

### Indicadores de Cambio

El campo `change_indicator` indica qué mostrar:

- **`"up"`** → Flecha verde ↑ + número de posiciones subidas
- **`"down"`** → Flecha roja ↓ + número de posiciones bajadas
- **`"neutral"`** → Sin cambio (guión o nada)
- **`"new"`** → Badge "NUEVO" o estrella ⭐

### Ejemplo en React/JavaScript

```javascript
function renderChangeIndicator(user) {
  switch (user.change_indicator) {
    case 'up':
      return (
        <span style={{ color: 'green' }}>
          ↑ {user.position_change}
        </span>
      );
    
    case 'down':
      return (
        <span style={{ color: 'red' }}>
          ↓ {user.position_change}
        </span>
      );
    
    case 'new':
      return (
        <span style={{ color: 'gold' }}>⭐ NUEVO</span>
      );
    
    default:
      return <span style={{ color: 'gray' }}>—</span>;
  }
}
```

### Ejemplo con Tailwind CSS

```jsx
{user.change_indicator === 'up' && (
  <span className="text-green-500 font-bold">
    ↑ {user.position_change}
  </span>
)}

{user.change_indicator === 'down' && (
  <span className="text-red-500 font-bold">
    ↓ {user.position_change}
  </span>
)}

{user.change_indicator === 'new' && (
  <span className="text-yellow-500 font-bold">⭐ NUEVO</span>
)}

{user.change_indicator === 'neutral' && (
  <span className="text-gray-400">—</span>
)}
```

---

## ⚙️ Configuración (Opcional)

### Variables de Entorno

Agrega a tu `.env` (valores por defecto si no se especifican):

```bash
# Cada cuántas horas crear un snapshot automático
LEADERBOARD_SNAPSHOT_INTERVAL_HOURS=6

# Cuántos días de histórico mantener
LEADERBOARD_CLEANUP_DAYS=30
```

### Valores Recomendados

- **Producción:** `6` horas (4 snapshots al día)
- **Testing:** `1` hora (para ver cambios rápido)

---

## 🔄 Flujo del Sistema

1. **Primera vez:** Al iniciar, se crea un snapshot inicial
2. **Automático:** Cada 6 horas se crea un nuevo snapshot
3. **Comparación:** Los endpoints comparan el ranking actual vs. el último snapshot
4. **Indicadores:** Se calculan las flechas basado en la diferencia de posiciones

### Timeline Ejemplo

```
12:00 PM → Snapshot 1 creado (posiciones guardadas)
           Usuario A está en posición #5

6:00 PM  → Snapshot 2 creado
           Usuario A ahora está en posición #3
           Resultado: ↑2 (subió 2 posiciones)

12:00 AM → Snapshot 3 creado
           Usuario A ahora está en posición #4
           Resultado: ↓1 (bajó 1 posición)
```

---

## 📝 Checklist de Integración Frontend

- [ ] Crear componente `Leaderboard.jsx`
- [ ] Implementar fetch del endpoint `/api/leaderboard`
- [ ] Renderizar tabla con posiciones
- [ ] Mostrar flechas según `change_indicator`
- [ ] Destacar top 3 con colores especiales (oro, plata, bronce)
- [ ] Mostrar avatar del usuario (de `kick_data.profile_pic`)
- [ ] Mostrar badge VIP si `is_vip === true`
- [ ] Implementar paginación (limit/offset)
- [ ] Agregar sección "Mi Posición" con `/api/leaderboard/me`
- [ ] Actualizar cada 5-10 minutos automáticamente
- [ ] Agregar animaciones/transiciones

---

## 🎯 Mejoras Sugeridas para el Frontend

### 1. Top 3 Especial
```jsx
<div className="podium">
  {/* Medallas de oro, plata, bronce */}
  {topThree.map((user, index) => (
    <div className={`medal-${index + 1}`}>
      <span className="medal-emoji">
        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
      </span>
      <img src={user.kick_data?.profile_pic} />
      <p>{user.nickname}</p>
      <p>{user.puntos} pts</p>
    </div>
  ))}
</div>
```

### 2. Animación de Cambios
```css
.position-change-up {
  animation: slideUp 0.5s ease-out;
}

.position-change-down {
  animation: slideDown 0.5s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

### 3. Comparador de Progreso
```jsx
<div className="progress-bar">
  <span>Te faltan {nextUser.puntos - myPoints} puntos para superar a {nextUser.nickname}</span>
</div>
```

### 4. Filtros y Búsqueda
```jsx
<input 
  type="text" 
  placeholder="Buscar usuario..."
  onChange={(e) => filterUsers(e.target.value)}
/>

<select onChange={(e) => filterByType(e.target.value)}>
  <option value="all">Todos</option>
  <option value="vip">Solo VIP</option>
  <option value="regular">Regulares</option>
</select>
```

---

## 🐛 Solución de Problemas

### Los indicadores siempre muestran "new"

**Causa:** No hay snapshots previos para comparar.

**Solución:** 
1. Espera 6 horas para el snapshot automático, o
2. Crea uno manualmente (requiere permisos de admin):
   ```bash
   curl -X POST http://localhost:3001/api/leaderboard/snapshot \
     -H "Authorization: Bearer <admin-token>"
   ```

### El leaderboard no se actualiza

**Verifica logs:**
```bash
docker-compose logs -f backend | grep LEADERBOARD
```

**Forzar snapshot manual:**
```bash
node -e "require('./src/services/leaderboard.service').createSnapshot().then(() => process.exit())"
```

### Tabla muy grande (muchos registros)

**Ajusta el cleanup:**
```bash
# En .env
LEADERBOARD_CLEANUP_DAYS=14  # Mantener solo 14 días
```

**O ejecuta manualmente:**
```bash
curl -X DELETE "http://localhost:3001/api/leaderboard/snapshots/old?days=14" \
  -H "Authorization: Bearer <admin-token>"
```

---

## 📚 Documentación Completa

Lee `LEADERBOARD-SYSTEM.md` para:
- Documentación completa de todos los endpoints
- Ejemplos de código completos
- Optimizaciones de rendimiento
- Casos de uso avanzados

---

## ✅ Sistema Listo

El sistema de leaderboard está **100% funcional** y listo para usar.

**Próximos pasos:**
1. ✅ Ejecutar migración (`npx sequelize-cli db:migrate`)
2. ✅ Reiniciar el servidor
3. 🎨 Integrar en tu frontend
4. 🚀 ¡Disfrutar!

---

**¿Dudas?** Consulta `LEADERBOARD-SYSTEM.md` o los comentarios en el código.

**¡Éxito con tu proyecto! 🚀**