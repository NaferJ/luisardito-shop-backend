# 🎁 Sistema de Recompensas de Kick

## 📋 Descripción

Sistema completo para gestionar recompensas de Kick y otorgar puntos automáticamente cuando los usuarios las canjeen.

## 🚀 Características

- ✅ Sincronización automática con recompensas de Kick
- ✅ CRUD completo de recompensas desde el admin
- ✅ Webhook automático para detectar canjeos
- ✅ Otorga puntos configurables por cada canje
- ✅ Auto-aceptación de canjeos (opcional)
- ✅ Historial completo de canjeos
- ✅ Estadísticas de uso

## 🛠️ Instalación

### 1. Ejecutar migración

```bash
npm run migrate
```

Esto creará la tabla `kick_rewards` con todos los campos necesarios.

### 2. Inicializar recompensas

```bash
node init-kick-rewards.js
```

Esto:
- Sincroniza las recompensas actuales de Kick
- Muestra un resumen de las recompensas disponibles
- Proporciona instrucciones para configurarlas

### 3. Configurar puntos a otorgar

Para cada recompensa, configura cuántos puntos otorgar:

```bash
curl -X PATCH http://localhost:3000/api/admin/kick-rewards/1/points \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"puntos_a_otorgar": 10000, "auto_accept": true}'
```

### 4. Verificar webhooks

El evento `channel.reward.redemption.updated` ya está incluido en la suscripción automática de webhooks.

## 📡 API Endpoints

### Admin - Recompensas

Todos los endpoints requieren autenticación y permiso `administrar_puntos`.

#### Obtener todas las recompensas
```http
GET /api/admin/kick-rewards
```

**Respuesta:**
```json
{
  "success": true,
  "total": 5,
  "rewards": [...]
}
```

#### Obtener una recompensa
```http
GET /api/admin/kick-rewards/:id
```

#### Sincronizar desde Kick
```http
POST /api/admin/kick-rewards/sync
```

Sincroniza las recompensas desde Kick API. Útil cuando:
- Se crean recompensas directamente en Kick
- Se modifican desde el dashboard de Kick
- Hay desincronización

#### Crear recompensa
```http
POST /api/admin/kick-rewards
```

**Body:**
```json
{
  "title": "10K Kiosko",
  "description": "Recibe 10,000 puntos para canjear",
  "cost": 10000,
  "puntos_a_otorgar": 10000,
  "background_color": "#00e701",
  "is_enabled": true,
  "is_user_input_required": false,
  "auto_accept": true
}
```

**Validaciones:**
- `title`: Máximo 50 caracteres (requerido)
- `cost`: Mínimo 1 (requerido)
- `puntos_a_otorgar`: Requerido
- `description`: Máximo 200 caracteres (opcional)

#### Actualizar recompensa completa
```http
PATCH /api/admin/kick-rewards/:id
```

Actualiza la recompensa tanto en Kick como localmente.

**Body:** (todos opcionales)
```json
{
  "title": "Nuevo título",
  "description": "Nueva descripción",
  "cost": 15000,
  "puntos_a_otorgar": 15000,
  "is_enabled": false,
  "is_paused": true,
  "auto_accept": false
}
```

#### Actualizar solo puntos (local)
```http
PATCH /api/admin/kick-rewards/:id/points
```

Actualiza solo los puntos a otorgar y auto-aceptación. **No** modifica la recompensa en Kick.

**Body:**
```json
{
  "puntos_a_otorgar": 5000,
  "auto_accept": true
}
```

#### Eliminar recompensa
```http
DELETE /api/admin/kick-rewards/:id
```

Elimina la recompensa tanto de Kick como de la BD local.

#### Obtener estadísticas
```http
GET /api/admin/kick-rewards/stats
```

**Respuesta:**
```json
{
  "success": true,
  "stats": {
    "total": 5,
    "enabled": 4,
    "disabled": 1,
    "paused": 0,
    "with_user_input": 1,
    "total_redemptions": 150,
    "total_points_configured": 50000,
    "most_redeemed": [
      {
        "title": "10K Kiosko",
        "total_redemptions": 50,
        "puntos_a_otorgar": 10000
      }
    ]
  }
}
```

## 🔔 Webhook: Canje de Recompensa

Cuando un usuario canjea una recompensa en Kick, se recibe el webhook:

**Evento:** `channel.reward.redemption.updated`

**Payload:**
```json
{
  "id": "01KBHE78QE4HZY1617DK5FC7YD",
  "user_input": "texto opcional del usuario",
  "status": "accepted",
  "redeemed_at": "2025-12-02T22:54:19.323Z",
  "reward": {
    "id": "01KBHE7RZNHB0SKDV1H86CD4F3",
    "title": "10K Kiosko",
    "cost": 10000,
    "description": "Recibe 10K puntos"
  },
  "redeemer": {
    "user_id": 123,
    "username": "usuario123",
    "is_verified": false
  },
  "broadcaster": {
    "user_id": 333,
    "username": "luisardito"
  }
}
```

### Flujo de procesamiento

1. ✅ Webhook llega al servidor
2. ✅ Se busca la recompensa en BD local por `kick_reward_id`
3. ✅ Si no existe, se sincroniza automáticamente desde Kick
4. ✅ Se verifica que la recompensa esté habilitada
5. ✅ Se verifica que el estado no sea "rejected"
6. ✅ Se busca el usuario por `user_id_ext`
7. ✅ Se otorgan los `puntos_a_otorgar` configurados
8. ✅ Se registra en `historial_puntos`
9. ✅ Se incrementa `total_redemptions` de la recompensa
10. ✅ Si `auto_accept` está activado, se acepta automáticamente en Kick

## 📊 Base de Datos

### Tabla: kick_rewards

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INT | ID interno |
| kick_reward_id | STRING | ID de la recompensa en Kick (ULID) |
| title | STRING(50) | Título de la recompensa |
| description | STRING(200) | Descripción |
| cost | INT | Costo en puntos de Kick |
| background_color | STRING(7) | Color hex (#00e701) |
| puntos_a_otorgar | INT | **Puntos a otorgar en nuestra app** |
| is_enabled | BOOLEAN | Si está habilitada |
| is_paused | BOOLEAN | Si está pausada |
| is_user_input_required | BOOLEAN | Si requiere input del usuario |
| should_redemptions_skip_request_queue | BOOLEAN | Si salta la cola |
| auto_accept | BOOLEAN | Si se acepta automáticamente |
| total_redemptions | INT | Total de canjeos |
| last_synced_at | DATE | Última sincronización |

## 🎯 Casos de Uso

### Caso 1: Recompensa "10K Kiosko"

Usuario canjea "10K Kiosko" en Kick (costo: 10,000 puntos de Kick).

**Configuración:**
```json
{
  "title": "10K Kiosko",
  "cost": 10000,
  "puntos_a_otorgar": 10000,
  "auto_accept": true
}
```

**Resultado:**
- Usuario pierde 10,000 puntos de Kick
- Usuario recibe 10,000 puntos en tu aplicación
- Se registra en historial con concepto: "Canje de recompensa: 10K Kiosko"
- Canje se acepta automáticamente

### Caso 2: Recompensa con input de usuario

Recompensa "Petición de canción" (requiere URL).

**Configuración:**
```json
{
  "title": "Petición de canción",
  "cost": 5000,
  "puntos_a_otorgar": 0,
  "is_user_input_required": true,
  "auto_accept": false
}
```

**Resultado:**
- Se recibe el webhook con `user_input: "https://youtube.com/..."`
- Como `puntos_a_otorgar` es 0, no se otorgan puntos
- Como `auto_accept` es false, el canje queda pendiente para revisión manual

### Caso 3: Recompensa sin puntos (solo notificación)

```json
{
  "title": "Destacar mensaje",
  "cost": 500,
  "puntos_a_otorgar": 0,
  "auto_accept": true
}
```

**Resultado:**
- Se detecta el canje pero no se otorgan puntos
- Puedes usar el historial de webhooks para otros propósitos

## 🔧 Configuración Avanzada

### Auto-aceptación de canjeos

Por defecto, `auto_accept` está en `true`. Esto acepta automáticamente los canjeos después de procesar los puntos.

Para recompensas que requieren revisión manual (ej: unban request), configurar `auto_accept: false`.

### Sincronización periódica

Puedes crear un cron job para sincronizar recompensas periódicamente:

```javascript
// En tu código
const cron = require('node-cron');
const KickRewardService = require('./src/services/kickReward.service');

// Cada 6 horas
cron.schedule('0 */6 * * *', async () => {
    await KickRewardService.syncRewardsFromKick();
});
```

## 🐛 Troubleshooting

### Las recompensas no se sincronizan

1. Verificar credenciales en `.env`:
   - `KICK_CLIENT_ID`
   - `KICK_CLIENT_SECRET`

2. Verificar logs:
```bash
docker-compose logs -f api | grep "Kick Rewards"
```

3. Probar sincronización manual:
```bash
curl -X POST http://localhost:3000/api/admin/kick-rewards/sync \
     -H "Authorization: Bearer YOUR_TOKEN"
```

### Los webhooks no llegan

1. Verificar que el evento esté suscrito:
```bash
curl http://localhost:3000/api/kick-admin/diagnostic-tokens
```

2. Re-suscribir webhooks:
```bash
curl -X POST http://localhost:3000/api/kick-admin/setup-permanent-webhooks \
     -H "Authorization: Bearer YOUR_TOKEN"
```

### No se otorgan puntos al canjear

1. Verificar logs del webhook:
```bash
docker-compose logs -f api | grep "Reward Redemption"
```

2. Verificar que la recompensa tenga `puntos_a_otorgar > 0`:
```bash
curl http://localhost:3000/api/admin/kick-rewards
```

3. Verificar que el usuario esté registrado:
- El usuario debe haberse autenticado al menos una vez en tu app

## 📈 Monitoreo

### Ver estadísticas

```bash
curl http://localhost:3000/api/admin/kick-rewards/stats \
     -H "Authorization: Bearer YOUR_TOKEN"
```

### Ver historial de canjeos

```bash
curl http://localhost:3000/api/historial-puntos?tipo=ganado&concepto=Canje \
     -H "Authorization: Bearer YOUR_TOKEN"
```

## 🎉 Ejemplos de Frontend

### Listar recompensas disponibles

```javascript
const response = await fetch('https://api.luisardito.com/api/admin/kick-rewards', {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});

const data = await response.json();
console.log(data.rewards);
```

### Configurar puntos de una recompensa

```javascript
await fetch(`https://api.luisardito.com/api/admin/kick-rewards/${rewardId}/points`, {
    method: 'PATCH',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        puntos_a_otorgar: 10000,
        auto_accept: true
    })
});
```

### Crear nueva recompensa

```javascript
await fetch('https://api.luisardito.com/api/admin/kick-rewards', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        title: '5K Puntos',
        description: 'Recibe 5,000 puntos',
        cost: 5000,
        puntos_a_otorgar: 5000,
        auto_accept: true
    })
});
```

## ✅ Checklist de Implementación

- [x] Modelo y migración `KickReward`
- [x] Servicio `KickRewardService` para API de Kick
- [x] Handler de webhook `channel.reward.redemption.updated`
- [x] Controller y routes CRUD para admin
- [x] Integración con sistema de puntos e historial
- [x] Auto-suscripción al evento en webhooks
- [x] Script de inicialización
- [x] Documentación completa

## 🚀 ¡Listo para usar!

El sistema está completamente implementado y listo para usarse. Solo necesitas:

1. Ejecutar la migración
2. Ejecutar el script de inicialización
3. Configurar los puntos para cada recompensa
4. ¡Los usuarios ya pueden canjear y recibir puntos automáticamente!
