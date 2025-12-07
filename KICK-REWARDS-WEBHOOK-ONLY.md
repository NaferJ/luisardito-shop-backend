# 🎁 Sistema de Recompensas de Kick - Webhook Only

## 📋 Descripción General

Sistema simplificado que **detecta automáticamente** cuando un espectador canjea una recompensa en Kick.com y otorga puntos en la tienda según la configuración local.

## ⚙️ Arquitectura

### ✅ Lo que SÍ funciona (Implementado)
- **Webhook de canjeos**: Detecta automáticamente `channel.reward.redemption.updated`
- **Otorgar puntos**: Sistema local para configurar puntos por cada recompensa
- **Auto-aceptar**: Opcional para cada recompensa
- **Historial**: Registro completo de todos los canjeos

### ❌ Lo que NO funciona (Limitación de Kick API)
- **CRUD de recompensas**: Requiere User Access Token (expira cada 2 horas)
- **Sincronización automática**: No se pueden listar recompensas con App Token
- Las recompensas se crean/editan **manualmente en Kick.com**

## 🔄 Flujo de Funcionamiento

```
1. 👤 Streamer crea recompensa en Kick.com
2. 🔧 Admin configura puntos en panel local
3. 🎁 Viewer canjea recompensa en Kick
4. 📡 Webhook detecta el canje
5. ✅ Sistema otorga puntos automáticamente
```

## 📊 Tabla: kick_rewards

```sql
CREATE TABLE kick_rewards (
  id INT PRIMARY KEY AUTO_INCREMENT,
  kick_reward_id VARCHAR(255) UNIQUE,     -- ID de la recompensa en Kick
  title VARCHAR(255),                      -- Nombre de la recompensa
  description TEXT,
  cost INT,                                -- Costo en puntos de canal Kick
  puntos_a_otorgar INT DEFAULT 0,         -- 🎯 Puntos que otorga nuestro sistema
  auto_accept BOOLEAN DEFAULT true,        -- Si acepta automáticamente
  is_enabled BOOLEAN DEFAULT true,
  total_redemptions INT DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## 🎯 Configuración de Recompensas

### Método 1: Manual en BD (Recomendado)
```sql
INSERT INTO kick_rewards (
  kick_reward_id, 
  title, 
  cost, 
  puntos_a_otorgar, 
  auto_accept
) VALUES (
  '01J38XYZ...', 
  'Saludo en stream', 
  1000, 
  50,
  true
);
```

### Método 2: Desde el Frontend
Crear endpoint simple para admin:
```javascript
// POST /api/admin/kick-rewards/configure
{
  "kick_reward_id": "01J38XYZ...",
  "puntos_a_otorgar": 50,
  "auto_accept": true
}
```

## 📡 Webhook Event

El webhook `channel.reward.redemption.updated` envía:

```json
{
  "event": "channel.reward.redemption.updated",
  "data": {
    "id": "01J38XYZ...",
    "reward": {
      "id": "01J123ABC...",
      "title": "Saludo en stream",
      "cost": 1000
    },
    "user": {
      "username": "viewer123"
    },
    "status": "pending",
    "user_input": "Hola desde México!"
  }
}
```

## 🔐 Autenticación

- **App Access Token**: Usado para webhooks ✅
- **Scopes necesarios**: `events:subscribe` solamente
- No se requieren scopes de `channel:rewards:*`

## 📝 Pasos para Implementar Nueva Recompensa

1. **Crear en Kick.com**:
   - Dashboard → Channel Points → Create Reward
   - Configurar título, costo, descripción
   - Copiar el ID de la recompensa

2. **Configurar localmente**:
   ```sql
   INSERT INTO kick_rewards (kick_reward_id, title, puntos_a_otorgar, auto_accept)
   VALUES ('ID_DE_KICK', 'Nombre', 100, true);
   ```

3. **Probar**:
   - Viewer canjea en Kick
   - Verificar logs: `🎁 [Webhook] Procesando canje de recompensa...`
   - Verificar puntos en historial

## 🚀 Ventajas de este Enfoque

✅ **Simple**: No maneja tokens expirados  
✅ **Confiable**: App Token nunca expira  
✅ **Automático**: Detecta canjeos en tiempo real  
✅ **Flexible**: Puntos configurables por recompensa  

## 📚 Archivos Relacionados

- **Webhook Handler**: `src/controllers/kickWebhook.controller.js` (función `handleRewardRedemption`)
- **Service**: `src/services/kickReward.service.js` (solo consultas locales)
- **Model**: `src/models/kickReward.model.js`
- **Migration**: `migrations/20251207000001-create-kick-rewards.js`

## 🔍 Testing

```bash
# Ver logs de webhooks
docker logs -f luisardito-backend | grep "Webhook"

# Ver configuración de recompensas
docker exec -it luisardito-backend mysql -u root -p -e "SELECT * FROM kick_rewards;"
```

## ❓ FAQ

**¿Por qué no hay endpoints CRUD?**  
Los endpoints de Kick API requieren User Access Token que expira cada 2 horas. Para mantener simplicidad, las recompensas se gestionan manualmente.

**¿Cómo sé el ID de una recompensa?**  
Se puede obtener del webhook al hacer un primer canje, o inspeccionando el dashboard de Kick.

**¿Puedo cambiar los puntos sin reiniciar?**  
Sí, es solo una columna en BD. Cambios son inmediatos.
