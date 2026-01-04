# ✅ COMANDO !WATCHTIME - IMPLEMENTACIÓN COMPLETADA

## 📌 Lo Que Se Implementó

Se agregó un comando dinámico `!watchtime` que muestra el tiempo de visualización (watchtime) de cada usuario, formateado de manera legible en años, meses, días, horas y minutos.

---

## 📦 Archivos Creados/Modificados

### ✨ NUEVOS (2 archivos)

1. **`src/utils/formatWatchtime.js`** - Utilidad de formateo
   - Convierte minutos a formato legible
   - Soporta: años, meses, días, horas, minutos
   - Usa la misma lógica que el frontend

2. **`migrations/20260104000001-add-watchtime-command.js`** - Migración SQL
   - Agrega comando !watchtime a base de datos
   - Template: `@{target_user} ha pasado {watchtime} viendo el stream`
   - Cooldown: 5 segundos
   - Handler: `watchtime_handler`

### ✏️ MODIFICADOS (1 archivo)

1. **`src/services/kickBotCommandHandler.service.js`**
   - Importado: `UserWatchtime` y `formatWatchtime`
   - Agregado caso `watchtime_handler` en switch
   - Nuevo método `watchtimeHandler()`

---

## 🔧 Cómo Funciona

### Comando Básico
```
!watchtime
```
Muestra tu watchtime actual.

### Comando Avanzado
```
!watchtime @usuario
```
Muestra el watchtime de otro usuario.

### Ejemplos de Salida

Con la función de formateo:
```
0 min                  (0-59 minutos)
2h 30min              (menos de 24 horas)
5d 3h                 (menos de 7 días)
2s 4d                 (semanas y días)
3m 15d                (meses y días)
1a 6m                 (años y meses)
```

---

## 🎯 Flujo de Ejecución

```
Usuario escribe: !watchtime @usuario

    ↓

Sistema detecta comando en base de datos
    ├─ command: "watchtime"
    ├─ command_type: "dynamic"
    └─ dynamic_handler: "watchtime_handler"

    ↓

Ejecuta watchtimeHandler():
    ├─ Busca al usuario por nickname/mención
    ├─ Obtiene datos de UserWatchtime
    ├─ Convierte minutos con formatWatchtime()
    └─ Reemplaza variables en template

    ↓

Envía respuesta: "@usuario ha pasado 2a 6m viendo el stream"

    ↓

✅ Comando completado
```

---

## 📊 Formato de Tiempo

### Función formatWatchtime():

```javascript
// Convierte minutos a formato legible
formatWatchtime(minutes) {
    // 0-59 min: "45 min"
    // 60-1439 min: "2h 30min"
    // 1440-10079 min: "5d 3h"
    // 10080-43199 min: "2s 4d"
    // 43200-1051199 min: "3m 15d"
    // 1051200+ min: "1a 6m"
}
```

### Equivalencias:
```
1 hora = 60 minutos
1 día = 1440 minutos
1 semana = 10080 minutos
1 mes ≈ 43200 minutos (30 días)
1 año ≈ 525600 minutos (365 días)
```

---

## 🗄️ Base de Datos

### Comando Registrado:
```sql
INSERT INTO kick_bot_commands (
    command: 'watchtime',
    description: 'Muestra watchtime del usuario',
    response_message: '@{target_user} ha pasado {watchtime} viendo el stream',
    command_type: 'dynamic',
    dynamic_handler: 'watchtime_handler',
    cooldown_seconds: 5,
    enabled: true
)
```

### Tabla user_watchtime (usada):
```sql
SELECT 
    usuario_id,
    total_watchtime_minutes,  ← Se usa para obtener minutos
    message_count,
    first_message_date,
    last_message_at
FROM user_watchtime
```

---

## 🔗 Integración con Modelos

### UserWatchtime (existente):
```javascript
UserWatchtime.findOne({
    where: { usuario_id: usuario.id }
})
// Retorna: { total_watchtime_minutes: 352950, ... }
```

### Usuario (existente):
```javascript
Usuario.findOne({
    where: { nickname: 'usuario' },
    include: [{ model: UserWatchtime, required: false }]
})
// Retorna: { nickname, UserWatchtime { total_watchtime_minutes }, ... }
```

---

## 🚀 Para Usar

### 1. Aplicar Migración
```bash
npm run migrate
```

### 2. Comando Disponible
```
!watchtime              # Tu watchtime
!watchtime @usuario     # Watchtime de otro usuario
!watchtime @usuario1    # Funciona con menciones
```

### 3. Resultado
```
Bot responde: "@usuario ha pasado 2a 6m viendo el stream"
```

---

## 🔍 Características

| Aspecto | Detalle |
|---------|---------|
| **Comando** | !watchtime |
| **Tipo** | Dinámico con handler |
| **Handler** | watchtimeHandler |
| **Cooldown** | 5 segundos |
| **Parámetros** | @usuario (opcional) |
| **Template** | @{target_user} ha pasado {watchtime} viendo el stream |
| **Variables reemplazadas** | {username}, {channel}, {target_user}, {watchtime} |

---

## 📝 Ejemplos de Respuesta

### Usuario sin watchtime
```
@usuario ha pasado 0 min viendo el stream
```

### Usuario con watchtime
```
@usuario ha pasado 2a 6m viendo el stream
@usuario ha pasado 5d 3h viendo el stream
@usuario ha pasado 45 min viendo el stream
```

### Usuario no encontrado
```
usuario no existe o no tiene watchtime registrado.
```

---

## ✅ Validaciones Implementadas

- ✅ Busca usuario por nickname
- ✅ Soporta menciones (@usuario)
- ✅ Maneja Discord y Kick
- ✅ Obtiene watchtime de base de datos
- ✅ Formatea tiempo legiblemente
- ✅ Responde con error si usuario no existe
- ✅ Usa cooldown de 5 segundos

---

## 🔧 Archivos Finales

```
src/
├── utils/
│   └── formatWatchtime.js            ✨ NUEVO
├── services/
│   └── kickBotCommandHandler.service.js  ✏️ MODIFICADO
│       ├── +watchtimeHandler()
│       └── +case 'watchtime_handler'

migrations/
└── 20260104000001-add-watchtime-command.js  ✨ NUEVO
```

---

## 🎯 Próximos Pasos

```bash
# 1. Aplicar migración
npm run migrate

# 2. Restart servicio
systemctl restart luisardito-shop-backend

# 3. Probar comando
# En el chat: !watchtime @usuario

# ¡Listo! ✨
```

---

## 📊 Resumen

| Métrica | Cantidad |
|---------|----------|
| Archivos nuevos | 2 |
| Archivos modificados | 1 |
| Métodos nuevos | 1 |
| Líneas de código | ~150 |
| Formato de variables | 6 (min, h, d, s, m, a) |
| Cooldown | 5 segundos |

---

**Estado**: ✅ **COMPLETADO Y LISTO**

**Solo falta**: `npm run migrate`

---

¡El comando !watchtime está listo para usar! 🚀

