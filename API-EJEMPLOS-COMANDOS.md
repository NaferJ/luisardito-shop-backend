# 🚀 API Ejemplos Rápidos - Comandos del Bot

## 🔑 Autenticación

Todos los endpoints requieren:
```http
Authorization: Bearer YOUR_JWT_TOKEN
```

**Nota:** Solo usuarios con rol `admin` pueden acceder.

---

## 📋 1. Listar Todos los Comandos

```bash
curl -X GET "http://localhost:3001/api/kick-admin/bot-commands" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Con filtros:**
```bash
# Solo comandos habilitados
curl -X GET "http://localhost:3001/api/kick-admin/bot-commands?enabled=true" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Buscar por nombre
curl -X GET "http://localhost:3001/api/kick-admin/bot-commands?search=tienda" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Con paginación
curl -X GET "http://localhost:3001/api/kick-admin/bot-commands?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔍 2. Obtener Comando por ID

```bash
curl -X GET "http://localhost:3001/api/kick-admin/bot-commands/1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ➕ 3. Crear Comando Simple (Discord)

```bash
curl -X POST "http://localhost:3001/api/kick-admin/bot-commands" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "discord",
    "aliases": ["dc", "server"],
    "response_message": "Únete a nuestro Discord: https://discord.gg/luisardito 🎮",
    "description": "Muestra el enlace del servidor de Discord",
    "command_type": "simple",
    "enabled": true,
    "cooldown_seconds": 30
  }'
```

---

## ➕ 4. Crear Comando Simple (Twitter)

```bash
curl -X POST "http://localhost:3001/api/kick-admin/bot-commands" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "twitter",
    "aliases": ["x", "tw"],
    "response_message": "Sígueme en Twitter/X: https://twitter.com/luisardito 🐦",
    "description": "Muestra el enlace de Twitter",
    "command_type": "simple",
    "enabled": true,
    "cooldown_seconds": 60
  }'
```

---

## ➕ 5. Crear Comando Simple (Reglas)

```bash
curl -X POST "http://localhost:3001/api/kick-admin/bot-commands" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "reglas",
    "aliases": ["rules"],
    "response_message": "📜 Reglas del chat: 1) Respeto mutuo 2) No spam 3) No spoilers 4) Diviértete!",
    "description": "Muestra las reglas del chat",
    "command_type": "simple",
    "enabled": true,
    "cooldown_seconds": 120
  }'
```

---

## ➕ 6. Crear Comando con Variables

```bash
curl -X POST "http://localhost:3001/api/kick-admin/bot-commands" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "bienvenida",
    "aliases": ["welcome"],
    "response_message": "¡Hola {username}! 👋 Bienvenido al canal de {channel}",
    "description": "Saluda a los nuevos usuarios",
    "command_type": "simple",
    "enabled": true,
    "cooldown_seconds": 0
  }'
```

---

## ✏️ 7. Actualizar Comando

```bash
curl -X PUT "http://localhost:3001/api/kick-admin/bot-commands/1" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "response_message": "NUEVO MENSAJE: Tienda del canal https://shop.luisardito.com/",
    "description": "Descripción actualizada",
    "cooldown_seconds": 15
  }'
```

---

## 🔄 8. Habilitar/Deshabilitar Comando

```bash
# Toggle (alterna el estado)
curl -X PATCH "http://localhost:3001/api/kick-admin/bot-commands/1/toggle" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔄 9. Duplicar Comando

```bash
curl -X POST "http://localhost:3001/api/kick-admin/bot-commands/1/duplicate" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🗑️ 10. Eliminar Comando

```bash
curl -X DELETE "http://localhost:3001/api/kick-admin/bot-commands/5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 11. Obtener Estadísticas

```bash
curl -X GET "http://localhost:3001/api/kick-admin/bot-commands/stats" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Respuesta:**
```json
{
  "ok": true,
  "data": {
    "summary": {
      "total": 10,
      "enabled": 8,
      "disabled": 2,
      "simple": 7,
      "dynamic": 3
    },
    "mostUsed": [
      {
        "id": 1,
        "command": "puntos",
        "usage_count": 500,
        "last_used_at": "2025-01-15T10:30:00Z"
      }
    ],
    "recentlyUsed": [...]
  }
}
```

---

## 🧪 12. Probar Comando (Sin Guardarlo)

```bash
curl -X POST "http://localhost:3001/api/kick-admin/bot-commands/test" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "response_message": "Hola {username}, tienes {points} puntos en {channel}!",
    "test_username": "JuanPerez",
    "test_args": "arg1 arg2"
  }'
```

**Respuesta:**
```json
{
  "ok": true,
  "data": {
    "original": "Hola {username}, tienes {points} puntos en {channel}!",
    "processed": "Hola JuanPerez, tienes 1000 puntos en luisardito!",
    "variables_used": {
      "username": "JuanPerez",
      "channel": "luisardito",
      "args": "arg1 arg2",
      "target_user": "JuanPerez",
      "points": "1000"
    }
  }
}
```

---

## 🌐 Desde JavaScript (Fetch)

### Listar Comandos
```javascript
const response = await fetch('http://localhost:3001/api/kick-admin/bot-commands', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
console.log(data);
```

### Crear Comando
```javascript
const response = await fetch('http://localhost:3001/api/kick-admin/bot-commands', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    command: 'youtube',
    aliases: ['yt'],
    response_message: 'Canal de YouTube: https://youtube.com/@luisardito',
    command_type: 'simple',
    enabled: true
  })
});
const data = await response.json();
console.log(data);
```

### Actualizar Comando
```javascript
const response = await fetch('http://localhost:3001/api/kick-admin/bot-commands/1', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    response_message: 'Nuevo mensaje actualizado',
    cooldown_seconds: 10
  })
});
const data = await response.json();
console.log(data);
```

### Toggle Comando
```javascript
const response = await fetch('http://localhost:3001/api/kick-admin/bot-commands/1/toggle', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
console.log(data);
```

### Eliminar Comando
```javascript
const response = await fetch('http://localhost:3001/api/kick-admin/bot-commands/1', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
console.log(data);
```

---

## 🎨 Ejemplos de Comandos Útiles

### 1. Comando de Redes Sociales
```json
{
  "command": "redes",
  "aliases": ["sociales", "social"],
  "response_message": "📱 Sígueme en:\n🐦 Twitter: @luisardito\n📷 Instagram: @luisardito\n🎮 Discord: discord.gg/luisardito",
  "command_type": "simple",
  "enabled": true
}
```

### 2. Comando de Donaciones
```json
{
  "command": "donar",
  "aliases": ["donate", "tip"],
  "response_message": "💰 ¿Quieres apoyar el stream? https://streamelements.com/luisardito/tip",
  "command_type": "simple",
  "enabled": true,
  "cooldown_seconds": 60
}
```

### 3. Comando de PC Specs
```json
{
  "command": "pc",
  "aliases": ["specs", "setup"],
  "response_message": "🖥️ MI PC: CPU: Intel i9-13900K | GPU: RTX 4090 | RAM: 32GB DDR5",
  "command_type": "simple",
  "enabled": true,
  "cooldown_seconds": 30
}
```

### 4. Comando de Horario
```json
{
  "command": "horario",
  "aliases": ["schedule", "stream"],
  "response_message": "📅 Horario de streams: Lunes a Viernes 8PM - 12AM (hora México)",
  "command_type": "simple",
  "enabled": true
}
```

### 5. Comando Interactivo con Usuario
```json
{
  "command": "saludar",
  "aliases": ["hola"],
  "response_message": "¡Hola {username}! 👋 Gracias por estar aquí en el stream de {channel}",
  "command_type": "simple",
  "enabled": true
}
```

---

## 🔤 Variables Disponibles

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `{username}` | Usuario que ejecutó el comando | `JuanPerez` |
| `{channel}` | Nombre del canal | `luisardito` |
| `{args}` | Argumentos pasados al comando | `argumento1 argumento2` |
| `{target_user}` | Usuario objetivo (comandos dinámicos) | `MariaGomez` |
| `{points}` | Puntos del usuario (comandos dinámicos) | `1500` |

---

## ⚠️ Códigos de Respuesta HTTP

| Código | Significado |
|--------|-------------|
| `200` | ✅ Éxito |
| `201` | ✅ Creado exitosamente |
| `400` | ❌ Datos inválidos |
| `401` | ❌ No autenticado |
| `403` | ❌ Sin permisos |
| `404` | ❌ Comando no encontrado |
| `409` | ❌ Conflicto (comando ya existe) |
| `500` | ❌ Error del servidor |

---

## 📖 Más Información

- **Documentación completa:** `BOT-COMMANDS-SYSTEM.md`
- **Resumen ejecutivo:** `RESUMEN-COMANDOS-BOT.md`

---

**Última actualización:** 2025-11-25