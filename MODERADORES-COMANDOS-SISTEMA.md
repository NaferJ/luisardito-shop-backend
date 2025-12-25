# 🛡️ Sistema de Comandos para Moderadores - Documentación Técnica

## 📋 Resumen Ejecutivo

Sistema que permite a moderadores de Kick gestionar comandos del bot directamente desde el chat mediante comandos especiales (`!addcmd`, `!editcmd`, `!delcmd`, `!cmdinfo`).

---

## 🏗️ Arquitectura del Sistema

### Componentes Principales

1. **Servicio Principal:** `src/services/kickModeratorCommands.service.js`
   - Procesa comandos de moderadores
   - Valida permisos
   - Maneja CRUD de comandos

2. **Integración Webhook:** `src/controllers/kickWebhook.controller.js`
   - Intercepta mensajes de chat
   - Detecta comandos de moderador
   - Envía respuestas al chat

3. **Modelo de Datos:** `src/models/kickBotCommand.model.js`
   - Almacena comandos en base de datos
   - Gestiona aliases y configuración

---

## 🔄 Flujo de Ejecución

```
1. Usuario escribe comando en chat de Kick
   ↓
2. Kick envía webhook → kickWebhook.controller.js
   ↓
3. handleChatMessage() detecta comandos que empiezan con !addcmd, !editcmd, !delcmd, !cmdinfo
   ↓
4. kickModeratorCommands.service.js procesa el comando
   ↓
5. Valida permisos (moderador/broadcaster)
   ↓
6. Parsea sintaxis y extrae parámetros
   ↓
7. Ejecuta acción en base de datos
   ↓
8. Genera respuesta de confirmación
   ↓
9. Envía respuesta al chat de Kick vía kickBot.service
```

---

## 🔐 Sistema de Permisos

### Niveles de Acceso

| Acción | Viewer | VIP | Moderador | Broadcaster |
|--------|--------|-----|-----------|-------------|
| `!addcmd` | ❌ | ❌ | ✅ | ✅ |
| `!editcmd` | ❌ | ❌ | ✅ | ✅ |
| `!delcmd` | ❌ | ❌ | ❌ | ✅ |
| `!cmdinfo` | ❌ | ❌ | ✅ | ✅ |

### Verificación de Permisos

```javascript
function isModerator(sender, broadcaster) {
  // Broadcaster siempre tiene permisos
  if (sender.user_id === broadcaster.user_id) {
    return true;
  }
  
  // Verificar badge de moderador
  const badges = sender.identity?.badges || [];
  return badges.some(badge => 
    badge.type === 'moderator' || badge.type === 'broadcaster'
  );
}
```

---

## 📝 Sintaxis de Comandos

### Parser de Comandos

El sistema utiliza un parser inteligente que maneja:

- **Comandos base:** `!addcmd`, `!editcmd`, `!delcmd`, `!cmdinfo`
- **Parámetros posicionales:** nombre del comando, respuesta
- **Flags opcionales:** `--aliases`, `--cooldown`, `--desc`, `--response`
- **Valores entre comillas:** Para textos con espacios

#### Ejemplo de Parsing

```javascript
Input: !addcmd discord Únete a Discord: discord.gg/abc --aliases dc,disc --cooldown 10

Parsed:
{
  command: '!addcmd',
  name: 'discord',
  flags: {
    response: 'Únete a Discord: discord.gg/abc',
    aliases: ['dc', 'disc'],
    cooldown: 10
  }
}
```

---

## 🗄️ Estructura de Base de Datos

### Tabla: `kick_bot_commands`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER | Primary key |
| `command` | STRING(50) | Nombre del comando (único) |
| `aliases` | JSON | Array de aliases |
| `response_message` | TEXT | Mensaje de respuesta |
| `description` | STRING(255) | Descripción interna |
| `command_type` | STRING(20) | `simple` o `dynamic` |
| `enabled` | BOOLEAN | Estado del comando |
| `cooldown_seconds` | INTEGER | Cooldown en segundos |
| `usage_count` | INTEGER | Contador de usos |
| `last_used_at` | DATE | Última vez usado |

### Valores por Defecto (Comandos de Moderadores)

```javascript
{
  command_type: 'simple',
  enabled: true,
  requires_permission: false,
  permission_level: 'viewer',
  cooldown_seconds: 3,
  auto_send_interval_seconds: 0,
  usage_count: 0
}
```

---

## 🛡️ Sistema de Protección

### Comandos Protegidos

Lista de comandos que **NO pueden ser eliminados**:

```javascript
const PROTECTED_COMMANDS = [
  'comandos',
  'puntos',
  'top',
  'tienda',
  'shop',
  'leaderboard',
  'rank',
  'ranking'
];
```

### Validaciones Automáticas

1. **Nombre único:** No se puede crear un comando que ya existe
2. **Aliases únicos:** Los aliases no pueden ser nombres de comandos existentes
3. **Permisos de eliminación:** Solo el broadcaster puede eliminar
4. **Protección de comandos críticos:** Comandos del sistema no se pueden eliminar

---

## 📤 Respuestas del Bot

### Formato de Respuestas

```javascript
{
  success: true/false,
  processed: true/false,
  message: "Mensaje para enviar al chat",
  data: { /* datos del comando */ }
}
```

### Manejo de Errores

- **Sin permisos:** No responde (evita spam)
- **Errores de sintaxis:** Mensaje explicativo
- **Errores de BD:** Mensaje genérico sin detalles técnicos

---

## 🔧 Integración con Webhook Handler

### Orden de Prioridad en handleChatMessage()

```javascript
1. Migración de Botrix (PRIORIDAD 1)
   ↓
2. Comandos de Moderadores (NUEVA PRIORIDAD 2) ⭐
   ↓
3. Comandos regulares del bot (PRIORIDAD 3)
   ↓
4. Verificación de stream en vivo
   ↓
5. Otorgamiento de puntos
```

### Código de Integración

```javascript
// En kickWebhook.controller.js - handleChatMessage()

const modCommands = ['!addcmd', '!editcmd', '!delcmd', '!cmdinfo'];

if (modCommands.some(cmd => content.startsWith(cmd))) {
  const ModeratorCommandsService = require("../services/kickModeratorCommands.service");
  const modResult = await ModeratorCommandsService.processModeratorCommand(payload);
  
  if (modResult.processed) {
    if (modResult.message) {
      const bot = require("../services/kickBot.service");
      await bot.sendMessage(modResult.message);
    }
    return; // Terminar procesamiento
  }
}
```

---

## 🧪 Testing

### Casos de Prueba Recomendados

#### Test 1: Crear comando básico
```
Input: !addcmd test Esto es una prueba
Expected: ✅ Comando "!test" creado exitosamente
```

#### Test 2: Crear con aliases
```
Input: !addcmd prueba Test --aliases test,testing
Expected: ✅ Comando "!prueba" creado exitosamente (Aliases: test, testing)
```

#### Test 3: Editar comando
```
Input: !editcmd prueba --cooldown 15
Expected: ✅ Comando "!prueba" actualizado: cooldown (15s)
```

#### Test 4: Intentar eliminar comando protegido
```
Input: !delcmd puntos
Expected: 🔒 El comando "!puntos" está protegido y no puede ser eliminado
```

#### Test 5: Usuario sin permisos
```
Input: !addcmd test Hola (como viewer)
Expected: (Sin respuesta)
```

---

## 📊 Logs del Sistema

### Eventos Registrados

```
✅ [MOD-CMD] Comando !nombre creado por usuario123
✅ [MOD-CMD] Comando !nombre editado por usuario123: respuesta, cooldown
✅ [MOD-CMD] Comando !nombre eliminado por broadcaster
📢 [MOD-CMD] Respuesta enviada al chat: ✅ Comando "!nombre" creado exitosamente
❌ [MOD-CMD] Error procesando comando de moderador: [detalles]
```

---

## 🚀 Deployment

### Archivos Modificados/Creados

1. **Nuevo:** `src/services/kickModeratorCommands.service.js`
2. **Modificado:** `src/controllers/kickWebhook.controller.js`
3. **Nueva documentación:** `MODERADORES-COMANDOS-GUIA.md`
4. **Nueva documentación técnica:** `MODERADORES-COMANDOS-SISTEMA.md`

### Checklist de Deployment

- [ ] Código mergeado a main/develop
- [ ] Base de datos actualizada (tabla `kick_bot_commands` existe)
- [ ] Variables de entorno configuradas
- [ ] Bot de Kick tiene permisos de envío de mensajes
- [ ] Webhooks de Kick configurados para `chat.message.sent`
- [ ] Documentación compartida con moderadores

### Testing en Producción

1. **Como moderador:** Crear un comando de prueba
2. **Como broadcaster:** Eliminar el comando de prueba
3. **Como viewer:** Verificar que no tiene acceso
4. **Verificar logs:** Confirmar que se registran eventos

---

## 🔄 Mantenimiento

### Tareas Recurrentes

1. **Revisar logs:** Buscar errores en comandos de moderadores
2. **Auditar comandos:** Verificar que no haya comandos duplicados o innecesarios
3. **Actualizar protegidos:** Agregar nuevos comandos críticos a `PROTECTED_COMMANDS`
4. **Feedback de moderadores:** Recopilar mejoras sugeridas

### Monitoreo Recomendado

```sql
-- Comandos más usados (creados por moderadores)
SELECT command, usage_count, last_used_at
FROM kick_bot_commands
WHERE description LIKE '%creado por @%'
ORDER BY usage_count DESC
LIMIT 10;

-- Comandos recientes
SELECT command, created_at, description
FROM kick_bot_commands
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🐛 Troubleshooting

### Problema: El bot no responde a comandos de moderador

**Posibles causas:**
1. Usuario no tiene badge de moderador
2. Webhook no configurado para `chat.message.sent`
3. Bot no tiene permisos de envío de mensajes
4. Error en sintaxis del comando

**Solución:**
```bash
# Verificar logs
docker logs -f luisardito-shop-backend

# Buscar errores
grep "MOD-CMD" logs/app.log
```

---

### Problema: Comando creado pero no funciona

**Posibles causas:**
1. Comando deshabilitado (`enabled: false`)
2. Cooldown muy alto
3. Conflicto con alias de otro comando

**Solución:**
```sql
-- Verificar estado del comando
SELECT * FROM kick_bot_commands WHERE command = 'nombre_comando';

-- Activar comando
UPDATE kick_bot_commands SET enabled = true WHERE command = 'nombre_comando';
```

---

### Problema: Error al parsear sintaxis

**Ejemplo:**
```
Input: !addcmd test
Error: ❌ Debes especificar una respuesta para el comando
```

**Solución:** Verificar que la sintaxis sea correcta según la documentación.

---

## 📚 Referencias

### Archivos Relacionados

- **Servicio:** `src/services/kickModeratorCommands.service.js`
- **Controlador:** `src/controllers/kickWebhook.controller.js`
- **Modelo:** `src/models/kickBotCommand.model.js`
- **Handler de comandos:** `src/services/kickBotCommandHandler.service.js`
- **Bot de Kick:** `src/services/kickBot.service.js`

### Documentación Relacionada

- `BOT-COMMANDS-SYSTEM.md` - Sistema de comandos del bot
- `KICK-REWARDS-WEBHOOK-ONLY.md` - Sistema de webhooks de Kick
- `MODERADORES-COMANDOS-GUIA.md` - Guía para moderadores

---

## 🎯 Roadmap Futuro

### Features Planificadas

- [ ] Comando `!togglecmd` para activar/desactivar sin eliminar
- [ ] Comando `!listcmds` para listar comandos creados por moderadores
- [ ] Sistema de permisos granular por comando
- [ ] Historial de cambios en comandos
- [ ] Rate limiting por moderador
- [ ] Categorías de comandos
- [ ] Exportar/importar comandos en JSON

### Mejoras Propuestas

- [ ] Parser más robusto con regex
- [ ] Soporte para comandos multi-línea
- [ ] Previsualización antes de crear
- [ ] Undo/redo de cambios
- [ ] Notificaciones de cambios en Discord

---

**Última actualización:** 24 de Enero, 2025
**Versión del sistema:** 1.0.0
**Autor:** Sistema Luisardito Shop Backend

