# 🛡️ Sistema de Comandos para Moderadores - Guía Completa

## 📋 Índice
1. [¿Qué es este sistema?](#qué-es-este-sistema)
2. [Comandos Disponibles](#comandos-disponibles)
3. [Ejemplos Prácticos](#ejemplos-prácticos)
4. [Variables Disponibles](#variables-disponibles)
5. [Comandos Protegidos](#comandos-protegidos)
6. [Preguntas Frecuentes](#preguntas-frecuentes)

---

## ¿Qué es este sistema?

Este sistema permite a los **moderadores** y al **broadcaster** crear, editar y gestionar comandos del bot **directamente desde el chat de Kick**, sin necesidad de acceder a la interfaz web de administración.

### ✅ ¿Quién puede usar estos comandos?

- ✅ **Broadcaster** (Luisardito): Puede usar TODOS los comandos
- ✅ **Moderadores**: Pueden crear y editar comandos (NO pueden eliminar)
- ❌ **Viewers regulares**: No tienen acceso a estos comandos

---

## Comandos Disponibles

### 1️⃣ `!addcmd` - Crear un nuevo comando

**Sintaxis básica:**
```
!addcmd <nombre> <respuesta>
```

**Sintaxis completa (con opciones):**
```
!addcmd <nombre> <respuesta> [--aliases alias1,alias2] [--cooldown 3] [--desc "descripción"]
```

**Parámetros:**
- `<nombre>`: Nombre del comando (sin el símbolo `!`)
- `<respuesta>`: Mensaje que el bot enviará cuando se use el comando
- `--aliases`: (Opcional) Otros nombres alternativos para el comando, separados por comas
- `--cooldown`: (Opcional) Tiempo de espera en segundos entre usos (por defecto: 3 segundos)
- `--desc`: (Opcional) Descripción del comando para uso interno

**Configuración por defecto:**
- Tipo: `simple` (respuesta estática)
- Cooldown: `3 segundos`
- Auto-envío: `desactivado`
- Estado: `activo`

---

### 2️⃣ `!editcmd` - Editar un comando existente

**Sintaxis:**
```
!editcmd <nombre> [--response "nueva respuesta"] [--aliases alias1,alias2] [--cooldown 5] [--desc "nueva desc"]
```

**Importante:**
- Solo necesitas especificar los campos que quieres cambiar
- Los demás campos se mantienen sin cambios
- Puedes cambiar uno o varios campos a la vez

---

### 3️⃣ `!delcmd` - Eliminar un comando

**Sintaxis:**
```
!delcmd <nombre>
```

**⚠️ RESTRICCIONES:**
- ⛔ **Solo el broadcaster puede eliminar comandos**
- ⛔ Los comandos protegidos NO pueden eliminarse (ver lista abajo)

---

### 4️⃣ `!cmdinfo` - Ver información de un comando

**Sintaxis:**
```
!cmdinfo <nombre>
```

**Muestra:**
- Respuesta actual del comando
- Aliases configurados
- Cooldown en segundos
- Estado (activo/desactivado)
- Número de veces usado

---

## Ejemplos Prácticos

### 📝 Ejemplo 1: Crear comando simple
```
!addcmd hola ¡Hola {username}! Bienvenido al stream de Luisardito
```
**Resultado:** El bot responderá con el mensaje cuando alguien escriba `!hola`

---

### 📝 Ejemplo 2: Crear comando con aliases
```
!addcmd discord Únete a nuestro Discord: discord.gg/luisardito --aliases dc,disc
```
**Resultado:** El comando funcionará con `!discord`, `!dc` o `!disc`

---

### 📝 Ejemplo 3: Crear comando completo
```
!addcmd horario Stream de Lunes a Viernes de 8PM a 12AM (hora México) --aliases schedule,hora --cooldown 10 --desc "Horario del stream"
```
**Resultado:** 
- Comando: `!horario` (también funciona con `!schedule` y `!hora`)
- Cooldown de 10 segundos
- Descripción guardada para referencia interna

---

### 📝 Ejemplo 4: Editar solo la respuesta
```
!editcmd discord Nuevo servidor de Discord: discord.gg/nuevo
```
**Resultado:** Solo cambia el mensaje de respuesta, mantiene aliases y cooldown

---

### 📝 Ejemplo 5: Editar solo el cooldown
```
!editcmd discord --cooldown 15
```
**Resultado:** Solo cambia el cooldown a 15 segundos, mantiene todo lo demás

---

### 📝 Ejemplo 6: Editar varios campos a la vez
```
!editcmd discord --aliases dc,discord,serv --cooldown 20
```
**Resultado:** Actualiza aliases y cooldown, mantiene la respuesta

---

### 📝 Ejemplo 7: Ver información de un comando
```
!cmdinfo discord
```
**Respuesta del bot:**
```
📋 Información del comando "!discord" | Respuesta: "Únete a nuestro Discord: discord.gg/luis..." | Aliases: dc, disc | Cooldown: 15s | Estado: Activo ✅ | Usos: 47
```

---

### 📝 Ejemplo 8: Eliminar un comando (solo broadcaster)
```
!delcmd comandoviejo
```
**Resultado:** El comando es eliminado permanentemente

---

## Variables Disponibles

Puedes usar estas variables en tus mensajes de respuesta y serán reemplazadas automáticamente:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `{username}` | Nombre del usuario que ejecutó el comando | `@JuanPerez` |
| `{channel}` | Nombre del canal | `luisardito` |
| `{args}` | Argumentos adicionales del comando | `hola mundo` |
| `{target_user}` | Usuario mencionado en el comando | `@OtroUsuario` |
| `{points}` | Puntos del usuario (si aplica) | `1500` |

### 📝 Ejemplo con variables:
```
!addcmd saludar ¡Hola {username}! Bienvenido al canal de {channel}
```

Cuando alguien escriba `!saludar`, el bot responderá:
```
¡Hola @JuanPerez! Bienvenido al canal de luisardito
```

---

## Comandos Protegidos

Los siguientes comandos **NO pueden ser eliminados** por seguridad del sistema:

- `!comandos` - Lista de comandos
- `!puntos` - Ver puntos del usuario
- `!top` - Ranking de puntos
- `!tienda` - Link a la tienda
- `!shop` - Alias de tienda
- `!leaderboard` - Tabla de posiciones
- `!rank` - Ver rango del usuario
- `!ranking` - Ver ranking

**Nota:** Estos comandos SÍ pueden ser editados, pero NO eliminados.

---

## Preguntas Frecuentes

### ❓ ¿Cuántos comandos puedo crear?
No hay límite técnico, pero se recomienda mantener una cantidad razonable (20-30 comandos máximo) para no saturar el chat.

---

### ❓ ¿Los comandos se aplican inmediatamente?
Sí, los cambios son instantáneos. No necesitas reiniciar nada.

---

### ❓ ¿Puedo crear comandos con el mismo nombre que uno existente?
No, el sistema te avisará que el comando ya existe. Usa `!editcmd` para modificarlo.

---

### ❓ ¿Qué pasa si me equivoco en la sintaxis?
El bot te responderá con un mensaje de error explicando qué salió mal.

---

### ❓ ¿Los aliases pueden ser nombres de comandos existentes?
No, si intentas usar un alias que ya existe como comando, el sistema te lo impedirá.

---

### ❓ ¿Cuál es el cooldown mínimo recomendado?
Se recomienda mínimo **3 segundos** para comandos generales y **10-15 segundos** para comandos que dan información repetitiva.

---

### ❓ ¿Puedo ver todos los comandos creados?
Sí, puedes ver todos los comandos en la interfaz web: https://luisardito.com/admin/comandos

---

### ❓ ¿Los comandos funcionan 24/7?
Sí, los comandos funcionan siempre, incluso cuando el stream está offline.

---

### ❓ ¿Puedo desactivar un comando temporalmente sin borrarlo?
Actualmente solo desde la interfaz web. Para desactivarlo desde el chat, necesitarías eliminarlo con `!delcmd` (solo broadcaster).

---

### ❓ ¿Qué pasa si borro un comando por accidente?
Tendrás que recrearlo con `!addcmd`. Los comandos eliminados no se pueden recuperar automáticamente.

---

## 📊 Respuestas del Bot

El bot siempre responde confirmando la acción realizada:

| Acción | Respuesta |
|--------|-----------|
| ✅ Comando creado | `✅ Comando "!nombre" creado exitosamente` |
| ✅ Comando editado | `✅ Comando "!nombre" actualizado: respuesta, cooldown` |
| ✅ Comando eliminado | `✅ Comando "!nombre" eliminado exitosamente` |
| ℹ️ Información mostrada | `📋 Información del comando "!nombre" ...` |
| ❌ Sin permisos | _(No responde para evitar spam)_ |
| ❌ Comando no existe | `❌ El comando "!nombre" no existe` |
| ❌ Comando ya existe | `❌ El comando "!nombre" ya existe. Usa !editcmd para modificarlo.` |
| ❌ Comando protegido | `🔒 El comando "!nombre" está protegido y no puede ser eliminado` |
| ❌ Solo broadcaster puede eliminar | `❌ Solo @luisardito puede eliminar comandos` |
| ❌ Falta respuesta | `❌ Debes especificar una respuesta para el comando` |
| ❌ Falta campo para editar | `❌ Debes especificar al menos un campo para actualizar` |

---

## 🎯 Consejos y Mejores Prácticas

### ✅ DO (Hacer)
- ✅ Usa nombres de comandos cortos y memorables
- ✅ Establece cooldowns apropiados para evitar spam
- ✅ Usa aliases para comandos con nombres largos
- ✅ Prueba el comando con `!cmdinfo` después de crearlo
- ✅ Usa descripciones claras para saber qué hace cada comando
- ✅ Usa variables como `{username}` para personalizar respuestas

### ❌ DON'T (No hacer)
- ❌ No uses nombres de comandos muy largos
- ❌ No pongas cooldowns muy bajos (menos de 3 segundos)
- ❌ No crees demasiados aliases para un mismo comando
- ❌ No uses caracteres especiales raros en los nombres
- ❌ No elimines comandos sin asegurarte de que no se usan

---

## 🆘 Soporte

Si tienes problemas con el sistema de comandos:

1. **Verifica tu rol:** Asegúrate de ser moderador o broadcaster
2. **Revisa la sintaxis:** Verifica que el comando esté bien escrito
3. **Consulta los logs:** El broadcaster puede revisar los logs del sistema
4. **Usa la interfaz web:** Como alternativa siempre puedes usar https://luisardito.com/admin/comandos

---

## 📝 Changelog

**v1.0.0** - 2025-01-24
- ✨ Sistema inicial de comandos para moderadores
- ✨ Comandos: `!addcmd`, `!editcmd`, `!delcmd`, `!cmdinfo`
- ✨ Soporte para aliases, cooldowns y descripciones
- ✨ Sistema de comandos protegidos
- ✨ Restricciones de permisos (solo broadcaster puede eliminar)

---

**Última actualización:** 24 de Enero, 2025
**Versión del sistema:** 1.0.0

