# 📚 Índice de Documentación - Sistema de Comandos para Moderadores

## 🎯 ¿Qué necesitas?

### 👥 Soy Moderador
📖 **Lee esto:** [`MODERADORES-COMANDOS-GUIA.md`](./MODERADORES-COMANDOS-GUIA.md)

Esta guía te enseña cómo:
- Crear comandos desde el chat
- Editar comandos existentes
- Consultar información de comandos
- Ver ejemplos prácticos

---

### 👨‍💻 Soy Desarrollador
📖 **Lee esto:** [`MODERADORES-COMANDOS-SISTEMA.md`](./MODERADORES-COMANDOS-SISTEMA.md)

Esta documentación técnica incluye:
- Arquitectura del sistema
- Flujo de ejecución
- Integración con webhooks
- Testing y debugging
- Troubleshooting

---

### ⚡ Necesito un resumen rápido
📖 **Lee esto:** [`MODERADORES-COMANDOS-RESUMEN.md`](./MODERADORES-COMANDOS-RESUMEN.md)

Referencia rápida con:
- Sintaxis de comandos
- Ejemplos básicos
- Permisos
- Variables disponibles

---

## 📁 Estructura de Archivos

```
📂 luisardito-shop-backend/
├── 📄 MODERADORES-COMANDOS-GUIA.md       ← Para moderadores
├── 📄 MODERADORES-COMANDOS-SISTEMA.md    ← Para desarrolladores
├── 📄 MODERADORES-COMANDOS-RESUMEN.md    ← Referencia rápida
├── 📄 MODERADORES-COMANDOS-INDEX.md      ← Este archivo
├── 📄 test-moderator-commands.js         ← Tests del sistema
│
└── 📂 src/
    ├── 📂 services/
    │   └── 📄 kickModeratorCommands.service.js   ← Lógica principal
    │
    └── 📂 controllers/
        └── 📄 kickWebhook.controller.js          ← Integración webhook
```

---

## 🚀 Quick Start

### Para Moderadores

1. **Abrir el chat de Kick**
2. **Escribir comando:**
   ```
   !addcmd test Hola mundo!
   ```
3. **El bot responde:**
   ```
   ✅ Comando "!test" creado exitosamente
   ```
4. **Probar el comando:**
   ```
   !test
   ```
5. **El bot responde:**
   ```
   Hola mundo!
   ```

📖 **Más ejemplos:** [`MODERADORES-COMANDOS-GUIA.md`](./MODERADORES-COMANDOS-GUIA.md)

---

### Para Desarrolladores

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Ejecutar tests:**
   ```bash
   node test-moderator-commands.js
   ```

3. **Verificar logs:**
   ```bash
   grep "MOD-CMD" logs/app.log
   ```

4. **Probar en chat de Kick** (como moderador)

📖 **Documentación completa:** [`MODERADORES-COMANDOS-SISTEMA.md`](./MODERADORES-COMANDOS-SISTEMA.md)

---

## 🔗 Enlaces Relacionados

### Documentación Interna
- [`BOT-COMMANDS-SYSTEM.md`](./BOT-COMMANDS-SYSTEM.md) - Sistema de comandos del bot
- [`API-EJEMPLOS-COMANDOS.md`](./API-EJEMPLOS-COMANDOS.md) - API de comandos
- [`KICK-REWARDS-WEBHOOK-ONLY.md`](./KICK-REWARDS-WEBHOOK-ONLY.md) - Webhooks de Kick

### Código Fuente
- [`src/services/kickModeratorCommands.service.js`](./src/services/kickModeratorCommands.service.js)
- [`src/controllers/kickWebhook.controller.js`](./src/controllers/kickWebhook.controller.js)
- [`src/models/kickBotCommand.model.js`](./src/models/kickBotCommand.model.js)

---

## ❓ FAQ Rápido

### ¿Quién puede usar estos comandos?
✅ Moderadores y broadcaster pueden crear/editar
⛔ Solo el broadcaster puede eliminar

### ¿Los cambios se aplican inmediatamente?
✅ Sí, son instantáneos

### ¿Puedo crear comandos con el mismo nombre?
❌ No, cada comando debe tener un nombre único

### ¿Dónde veo todos los comandos?
🌐 Panel web: https://luisardito.com/admin/comandos
💬 Chat: `!cmdinfo <nombre>`

### ¿Cómo elimino un comando?
💬 Chat (solo broadcaster): `!delcmd <nombre>`
🌐 Panel web: Botón "Eliminar"

---

## 🆘 Soporte

### 🐛 Reportar un bug
1. Verificar logs del sistema
2. Reproducir el error
3. Documentar pasos
4. Reportar al equipo de desarrollo

### 💡 Sugerir mejora
1. Describir la mejora propuesta
2. Explicar casos de uso
3. Compartir con el equipo

---

## 📊 Estadísticas del Sistema

Puedes consultar estadísticas en la base de datos:

```sql
-- Total de comandos creados
SELECT COUNT(*) FROM kick_bot_commands;

-- Comandos más usados
SELECT command, usage_count, last_used_at
FROM kick_bot_commands
ORDER BY usage_count DESC
LIMIT 10;

-- Comandos recientes
SELECT command, created_at, description
FROM kick_bot_commands
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🎓 Tutoriales

### Tutorial 1: Mi primer comando
1. Abre el chat de Kick
2. Escribe: `!addcmd hola Hola {username}!`
3. Prueba el comando: `!hola`
4. ¡Listo! 🎉

### Tutorial 2: Comando con aliases
1. Crea un comando con aliases:
   ```
   !addcmd discord Link: discord.gg/abc --aliases dc,disc
   ```
2. Prueba los aliases:
   - `!discord`
   - `!dc`
   - `!disc`
3. Todos funcionan igual 🎉

### Tutorial 3: Editar un comando
1. Edita la respuesta:
   ```
   !editcmd discord Nuevo link: discord.gg/xyz
   ```
2. Edita el cooldown:
   ```
   !editcmd discord --cooldown 15
   ```
3. Verifica los cambios:
   ```
   !cmdinfo discord
   ```

---

## 🔄 Changelog

### v1.0.0 - 2025-01-24
- ✨ Sistema inicial de comandos para moderadores
- ✨ Comandos: `!addcmd`, `!editcmd`, `!delcmd`, `!cmdinfo`
- ✨ Soporte para aliases, cooldowns y descripciones
- ✨ Sistema de permisos (moderador/broadcaster)
- ✨ Comandos protegidos
- 📝 Documentación completa
- 🧪 Suite de tests

---

## 📞 Contacto

Para dudas o soporte:
- **Discord:** [Servidor de Luisardito]
- **Kick:** @luisardito (chat)
- **GitHub:** [Issues del repositorio]

---

**Última actualización:** 24 de Enero, 2025
**Versión:** 1.0.0
**Estado:** ✅ Producción

