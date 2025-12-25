# 🛡️ Sistema de Comandos para Moderadores - Resumen Rápido

## 📌 ¿Qué es?

Sistema que permite a moderadores gestionar comandos del bot directamente desde el chat de Kick.

---

## ⚡ Comandos Disponibles

| Comando | Sintaxis | Descripción |
|---------|----------|-------------|
| `!addcmd` | `!addcmd <nombre> <respuesta> [opciones]` | Crear nuevo comando |
| `!editcmd` | `!editcmd <nombre> [opciones]` | Editar comando existente |
| `!delcmd` | `!delcmd <nombre>` | Eliminar comando (solo broadcaster) |
| `!cmdinfo` | `!cmdinfo <nombre>` | Ver información del comando |

---

## 🔑 Opciones Disponibles

| Opción | Formato | Descripción | Ejemplo |
|--------|---------|-------------|---------|
| `--aliases` | `--aliases alias1,alias2` | Nombres alternativos | `--aliases dc,disc` |
| `--cooldown` | `--cooldown <segundos>` | Tiempo de espera entre usos | `--cooldown 10` |
| `--desc` | `--desc "texto"` | Descripción del comando | `--desc "Info Discord"` |
| `--response` | `--response "texto"` | Nueva respuesta (solo edit) | `--response "Nuevo texto"` |

---

## 📝 Ejemplos Rápidos

### Crear comando simple
```
!addcmd hola Hola {username}, bienvenido!
```

### Crear con aliases y cooldown
```
!addcmd discord Link: discord.gg/abc --aliases dc,disc --cooldown 10
```

### Editar respuesta
```
!editcmd discord Nuevo link: discord.gg/xyz
```

### Editar cooldown
```
!editcmd discord --cooldown 15
```

### Ver información
```
!cmdinfo discord
```

### Eliminar (solo broadcaster)
```
!delcmd test
```

---

## 🔒 Permisos

| Acción | Moderador | Broadcaster |
|--------|-----------|-------------|
| Crear | ✅ | ✅ |
| Editar | ✅ | ✅ |
| Eliminar | ❌ | ✅ |
| Ver info | ✅ | ✅ |

---

## 🛡️ Comandos Protegidos (NO se pueden eliminar)

- `!comandos`
- `!puntos`
- `!top`
- `!tienda` / `!shop`
- `!leaderboard` / `!rank` / `!ranking`

---

## 🔧 Variables en Respuestas

| Variable | Resultado |
|----------|-----------|
| `{username}` | @Usuario que ejecutó el comando |
| `{channel}` | Nombre del canal |
| `{args}` | Argumentos adicionales |
| `{target_user}` | Usuario mencionado |
| `{points}` | Puntos del usuario |

---

## ✅ Valores por Defecto

Al crear un comando:
- **Tipo:** Simple (respuesta estática)
- **Cooldown:** 3 segundos
- **Auto-envío:** Desactivado
- **Estado:** Activo

---

## 📚 Documentación Completa

- **Para Moderadores:** `MODERADORES-COMANDOS-GUIA.md`
- **Técnica (Desarrollo):** `MODERADORES-COMANDOS-SISTEMA.md`

---

## 🧪 Testing

```bash
# Ejecutar tests de parser
node test-moderator-commands.js
```

---

## 🚀 Archivos del Sistema

- **Servicio:** `src/services/kickModeratorCommands.service.js`
- **Integración:** `src/controllers/kickWebhook.controller.js`
- **Modelo:** `src/models/kickBotCommand.model.js`

---

## 💡 Tips Rápidos

1. ✅ Usa nombres cortos y memorables
2. ✅ Cooldown mínimo: 3 segundos
3. ✅ Prueba con `!cmdinfo` después de crear
4. ❌ No uses nombres muy largos
5. ❌ No pongas cooldowns muy bajos

---

**Versión:** 1.0.0 | **Fecha:** 24/01/2025

