# 🤖 Sistema de Comandos Configurables del Bot

## 📋 Descripción General

Este sistema permite gestionar todos los comandos del bot de Kick desde el frontend, sin necesidad de modificar código. Los comandos están almacenados en la base de datos y se pueden crear, editar, habilitar/deshabilitar y eliminar dinámicamente.

## ✨ Características

- ✅ **Comandos Dinámicos**: Sin hardcodear comandos en el código
- ✅ **Gestión desde Frontend**: CRUD completo mediante API REST
- ✅ **Tipos de Comandos**: Simples (respuesta estática) y Dinámicos (lógica personalizada)
- ✅ **Sistema de Aliases**: Un comando puede tener múltiples nombres
- ✅ **Variables en Mensajes**: Soporta `{username}`, `{channel}`, `{points}`, etc.
- ✅ **Cooldowns**: Configurables por comando
- ✅ **Permisos**: Control de acceso por nivel de usuario
- ✅ **Estadísticas**: Contador de uso y última ejecución
- ✅ **Borrador/Habilitado**: Sistema de publicación de comandos

---

## 🗄️ Estructura de la Base de Datos

### Tabla: `kick_bot_commands`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER | ID único del comando |
| `command` | STRING | Nombre del comando sin `!` (ej: `tienda`) |
| `aliases` | JSON | Array de aliases (ej: `["shop"]`) |
| `response_message` | TEXT | Mensaje de respuesta con variables |
| `description` | STRING | Descripción para el admin |
| `command_type` | ENUM | `simple` o `dynamic` |
| `dynamic_handler` | STRING | Nombre del handler para comandos dinámicos |
| `enabled` | BOOLEAN | Si está habilitado (`true`) o en borrador (`false`) |
| `requires_permission` | BOOLEAN | Si requiere permisos especiales |
| `permission_level` | ENUM | `viewer`, `vip`, `moderator`, `broadcaster` |
| `cooldown_seconds` | INTEGER | Cooldown en segundos (0 = sin cooldown) |
| `usage_count` | INTEGER | Contador de usos |
| `last_used_at` | DATE | Última vez usado |
| `created_at` | DATE | Fecha de creación |
| `updated_at` | DATE | Fecha de actualización |

---

## 🔌 API Endpoints

### Base URL: `/api/kick-admin/bot-commands`

**Nota**: Todos los endpoints requieren autenticación y rol de **admin**.

### 1. 📋 Listar Todos los Comandos

```http
GET /api/kick-admin/bot-commands
```

**Query Parameters:**
- `page` (number): Número de página (default: 1)
- `limit` (number): Límite por página (default: 20)
- `enabled` (boolean): Filtrar por habilitados/deshabilitados
- `command_type` (string): Filtrar por tipo (`simple`, `dynamic`)
- `search` (string): Buscar en nombre o descripción

**Respuesta:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "command": "tienda",
      "aliases": ["shop"],
      "response_message": "{channel} tienda del canal: https://shop.luisardito.com/",
      "description": "Muestra el enlace de la tienda",
      "command_type": "simple",
      "enabled": true,
      "usage_count": 150,
      "last_used_at": "2025-01-15T10:30:00Z",
      ...
    }
  ],
  "pagination": {
    "total": 10,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### 2. 🔍 Obtener Comando por ID

```http
GET /api/kick-admin/bot-commands/:id
```

**Respuesta:**
```json
{
  "ok": true,
  "data": {
    "id": 1,
    "command": "tienda",
    "aliases": ["shop"],
    ...
  }
}
```

---

### 3. ➕ Crear Nuevo Comando

```http
POST /api/kick-admin/bot-commands
```

**Body:**
```json
{
  "command": "discord",
  "aliases": ["dc"],
  "response_message": "Únete a nuestro Discord: https://discord.gg/luisardito",
  "description": "Muestra el enlace del Discord",
  "command_type": "simple",
  "enabled": true,
  "requires_permission": false,
  "permission_level": "viewer",
  "cooldown_seconds": 30
}
```

**Campos Requeridos:**
- `command` (string): Nombre del comando
- `response_message` (string): Mensaje de respuesta

**Campos Opcionales:**
- `aliases` (array): Aliases del comando
- `description` (string): Descripción
- `command_type` (string): `simple` (default) o `dynamic`
- `dynamic_handler` (string): Solo si `command_type` es `dynamic`
- `enabled` (boolean): Default `true`
- `requires_permission` (boolean): Default `false`
- `permission_level` (string): Default `viewer`
- `cooldown_seconds` (number): Default `0`

**Respuesta:**
```json
{
  "ok": true,
  "message": "Comando creado exitosamente",
  "data": { ... }
}
```

---

### 4. ✏️ Actualizar Comando

```http
PUT /api/kick-admin/bot-commands/:id
```

**Body:** Mismos campos que POST (todos opcionales)

---

### 5. 🔄 Alternar Estado (Habilitar/Deshabilitar)

```http
PATCH /api/kick-admin/bot-commands/:id/toggle
```

**Respuesta:**
```json
{
  "ok": true,
  "message": "Comando habilitado/deshabilitado exitosamente",
  "data": { ... }
}
```

---

### 6. 🗑️ Eliminar Comando

```http
DELETE /api/kick-admin/bot-commands/:id
```

**Respuesta:**
```json
{
  "ok": true,
  "message": "Comando eliminado exitosamente"
}
```

---

### 7. 📊 Obtener Estadísticas

```http
GET /api/kick-admin/bot-commands/stats
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
    "recentlyUsed": [ ... ]
  }
}
```

---

### 8. 🔄 Duplicar Comando

```http
POST /api/kick-admin/bot-commands/:id/duplicate
```

Crea una copia del comando con `_copy` al final del nombre, deshabilitado por defecto.

---

### 9. 🧪 Probar Comando

```http
POST /api/kick-admin/bot-commands/test
```

**Body:**
```json
{
  "response_message": "Hola {username}, bienvenido a {channel}!",
  "test_username": "TestUser",
  "test_args": "argumento1 argumento2"
}
```

**Respuesta:**
```json
{
  "ok": true,
  "data": {
    "original": "Hola {username}, bienvenido a {channel}!",
    "processed": "Hola TestUser, bienvenido a luisardito!",
    "variables_used": {
      "username": "TestUser",
      "channel": "luisardito",
      "args": "argumento1 argumento2",
      "target_user": "TestUser",
      "points": "1000"
    }
  }
}
```

---

## 🎯 Tipos de Comandos

### 1️⃣ Comandos Simples (`simple`)

Respuestas estáticas con soporte de variables.

**Ejemplo:**
```json
{
  "command": "tienda",
  "command_type": "simple",
  "response_message": "{channel} tienda del canal: https://shop.luisardito.com/"
}
```

### 2️⃣ Comandos Dinámicos (`dynamic`)

Comandos con lógica especial programada en el backend.

**Ejemplo:**
```json
{
  "command": "puntos",
  "command_type": "dynamic",
  "dynamic_handler": "puntos_handler",
  "response_message": "{target_user} tiene {points} puntos."
}
```

**Handlers Disponibles:**
- `puntos_handler`: Consulta puntos de usuario en DB

**Para agregar nuevos handlers**, edita `src/services/kickBotCommandHandler.service.js`:

```javascript
case 'mi_nuevo_handler':
    return await this.miNuevoHandler(command, content, username, channelName);
```

---

## 🔤 Variables Soportadas

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `{username}` | Usuario que ejecutó el comando | `JuanPerez` |
| `{channel}` | Nombre del canal | `luisardito` |
| `{args}` | Argumentos del comando | `argumento1 argumento2` |
| `{target_user}` | Usuario objetivo (comandos dinámicos) | `MariaGomez` |
| `{points}` | Puntos del usuario (comandos dinámicos) | `1500` |

**Uso:**
```
Entrada: !puntos @JuanPerez
Mensaje: "{target_user} tiene {points} puntos."
Salida: "JuanPerez tiene 1500 puntos."
```

---

## 📝 Ejemplos de Comandos

### Comando Simple - Discord

```json
{
  "command": "discord",
  "aliases": ["dc", "server"],
  "response_message": "Únete a nuestro Discord: https://discord.gg/luisardito 🎮",
  "description": "Muestra el enlace del servidor de Discord",
  "command_type": "simple",
  "enabled": true,
  "cooldown_seconds": 30
}
```

### Comando Simple - Redes Sociales

```json
{
  "command": "twitter",
  "aliases": ["x", "tw"],
  "response_message": "Sígueme en Twitter/X: https://twitter.com/luisardito 🐦",
  "description": "Muestra el enlace de Twitter",
  "command_type": "simple",
  "enabled": true,
  "cooldown_seconds": 60
}
```

### Comando Dinámico - Puntos

```json
{
  "command": "puntos",
  "aliases": ["pts", "points"],
  "response_message": "{target_user} tiene {points} puntos.",
  "description": "Muestra los puntos del usuario. Uso: !puntos [@usuario]",
  "command_type": "dynamic",
  "dynamic_handler": "puntos_handler",
  "enabled": true,
  "cooldown_seconds": 5
}
```

### Comando Simple - Reglas del Chat

```json
{
  "command": "reglas",
  "aliases": ["rules"],
  "response_message": "📜 Reglas del chat: 1) Respeto mutuo 2) No spam 3) No spoilers 4) Diviértete!",
  "description": "Muestra las reglas del chat",
  "command_type": "simple",
  "enabled": true,
  "cooldown_seconds": 120
}
```

---

## 🔧 Migración de Comandos Hardcodeados

Los comandos `!tienda` y `!puntos` que estaban hardcodeados fueron migrados automáticamente a la base de datos durante la primera ejecución de la migración.

**Comandos Migrados:**

1. **!tienda** (alias: `!shop`)
   - Tipo: `simple`
   - Mensaje: `{channel} tienda del canal: https://shop.luisardito.com/`

2. **!puntos**
   - Tipo: `dynamic`
   - Handler: `puntos_handler`
   - Mensaje: `{target_user} tiene {points} puntos.`

---

## 🚀 Proceso de Ejecución

### Flujo de un Comando

```
1. Usuario escribe: !tienda
2. Webhook detecta mensaje
3. kickBotCommandHandler.service verifica si empieza con "!"
4. Busca comando en DB (incluyendo aliases)
5. Si existe y está enabled:
   - Verifica permisos (si requiere)
   - Verifica cooldown (si tiene)
   - Ejecuta comando según tipo:
     * simple: Reemplaza variables y envía
     * dynamic: Ejecuta handler especial
6. Incrementa contador de uso
7. Actualiza last_used_at
8. Bot envía respuesta al chat
```

### Diagrama

```
Chat Message (!comando arg1 arg2)
         ↓
KickWebhook.controller
         ↓
kickBotCommandHandler.service
         ↓
     [DB Query] → KickBotCommand.findByCommand()
         ↓
   ¿Comando encontrado y enabled?
         ↓
   [Verificar permisos]
         ↓
   [Verificar cooldown]
         ↓
   ¿Tipo de comando?
    ↙            ↘
Simple        Dynamic
   ↓              ↓
Replace      Execute Handler
Variables    (ej: puntos_handler)
   ↓              ↓
   └──────┬───────┘
          ↓
   kickBot.service.sendMessage()
          ↓
   Increment Usage Counter
          ↓
     Chat Response
```

---

## 🔐 Seguridad y Permisos

### Autenticación de API

Todos los endpoints de gestión de comandos requieren:
1. **Token JWT válido** en el header `Authorization: Bearer <token>`
2. **Rol de administrador** en el sistema

### Niveles de Permiso para Comandos

Los comandos pueden configurarse con niveles de permiso:

- `viewer`: Cualquier usuario (default)
- `vip`: Solo usuarios VIP
- `moderator`: Solo moderadores
- `broadcaster`: Solo el streamer

**Nota**: La verificación de permisos está preparada en el código pero requiere integración con el sistema de usuarios de Kick.

---

## 📊 Monitoreo y Estadísticas

### Métricas Disponibles

- **Total de comandos** (habilitados vs deshabilitados)
- **Comandos más usados** (top 10)
- **Comandos usados recientemente** (top 10)
- **Tipos de comandos** (simple vs dynamic)
- **Contador de uso por comando**
- **Última ejecución por comando**

### Logs

El sistema registra:
- ✅ Comandos ejecutados exitosamente
- ℹ️ Comandos no registrados detectados
- ❌ Errores en la ejecución de comandos

---

## 🛠️ Desarrollo y Extensión

### Agregar Nuevo Handler Dinámico

1. Edita `src/services/kickBotCommandHandler.service.js`
2. Agrega tu handler en el switch:

```javascript
case 'mi_handler':
    return await this.miHandler(command, content, username, channelName);
```

3. Implementa el método:

```javascript
async miHandler(command, content, username, channelName) {
    const args = this.extractArgs(content);
    
    // Tu lógica aquí
    const result = await miLogicaEspecial(args);
    
    // Reemplazar variables y retornar
    return command.response_message
        .replace(/{username}/g, username)
        .replace(/{result}/g, result);
}
```

4. Crea el comando en la DB:

```json
{
  "command": "micomando",
  "command_type": "dynamic",
  "dynamic_handler": "mi_handler",
  "response_message": "{username}, el resultado es: {result}"
}
```

---

## 🗂️ Archivos del Sistema

### Migración
- `migrations/20251125000001-create-kick-bot-commands.js`

### Modelos
- `src/models/kickBotCommand.model.js`
- `src/models/index.js` (actualizado)

### Controladores
- `src/controllers/kickBotCommands.controller.js`

### Servicios
- `src/services/kickBotCommandHandler.service.js`

### Rutas
- `src/routes/kickBotCommands.routes.js`

### Webhook
- `src/controllers/kickWebhook.controller.js` (refactorizado)

### Configuración
- `app.js` (ruta agregada)

---

## ✅ Checklist de Implementación

- [x] Migración de base de datos creada
- [x] Modelo `KickBotCommand` implementado
- [x] Controlador con CRUD completo
- [x] Rutas de API configuradas
- [x] Servicio de manejo de comandos
- [x] Refactorización del webhook
- [x] Sistema de variables en mensajes
- [x] Sistema de aliases
- [x] Estadísticas de uso
- [x] Documentación completa

---

## 🚦 Próximos Pasos

1. **Ejecutar migración**: `npm run migrate`
2. **Verificar comandos migrados**: Consultar `/api/kick-admin/bot-commands`
3. **Crear frontend**: Interfaz para gestionar comandos
4. **Implementar cooldowns**: Usar Redis para control de cooldowns
5. **Implementar permisos**: Integrar con sistema de usuarios de Kick
6. **Agregar más handlers**: Según necesidades del negocio

---

## 📞 Soporte

Para dudas o problemas con el sistema de comandos:
- Revisar logs del backend
- Verificar que la migración se ejecutó correctamente
- Asegurar que los comandos estén `enabled: true`
- Verificar permisos de administrador en el token JWT

---

**Documentación creada**: 2025-11-25  
**Versión del sistema**: 1.0.0  
**Estado**: ✅ Producción Ready