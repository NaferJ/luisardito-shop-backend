# 🤖 Configuración del Servicio de Mantenimiento Automático del Bot

## Variables de Entorno

### BOT_MAINTENANCE_INTERVAL_MINUTES
- **Descripción**: Intervalo en minutos para ejecutar el mantenimiento automático
- **Valor por defecto**: `60` (cada hora)
- **Ejemplo**: `BOT_MAINTENANCE_INTERVAL_MINUTES=30` (cada 30 minutos)

### BOT_MAINTENANCE_SIMULATE_ACTIVITY
- **Descripción**: Si debe simular actividad del chat (enviar mensajes !tienda)
- **Valor por defecto**: `false` (no simula)
- **Ejemplo**: `BOT_MAINTENANCE_SIMULATE_ACTIVITY=true` (sí simula)

## Ejemplo de configuración en .env

```bash
# Mantenimiento del bot cada 45 minutos
BOT_MAINTENANCE_INTERVAL_MINUTES=45

# Simular actividad del chat (enviar !tienda automáticamente)
BOT_MAINTENANCE_SIMULATE_ACTIVITY=true
```

## API Endpoints para Control Manual

### Ver estado del servicio
```bash
GET /api/kick-admin/bot-maintenance/status
```

### Iniciar servicio manualmente
```bash
POST /api/kick-admin/bot-maintenance/start
```

### Detener servicio
```bash
POST /api/kick-admin/bot-maintenance/stop
```

### Ejecutar mantenimiento ahora
```bash
POST /api/kick-admin/bot-maintenance/trigger
```

## Comportamiento por Defecto

- **Intervalo**: Cada 60 minutos (1 hora)
- **Simulación de actividad**: Deshabilitada
- **Inicio automático**: Sí (al iniciar el backend)
- **Limpieza de tokens**: Sí
- **Renovación de tokens**: Sí

## Logs que Verás

```
🤖 [BOT-MAINTENANCE] Iniciando mantenimiento automático cada 60 minutos
🔧 [BOT-MAINTENANCE] Iniciando mantenimiento programado...
🧹 [BOT-MAINTENANCE] 0 tokens expirados marcados como inactivos
✅ [BOT-MAINTENANCE] Token válido y renovado si era necesario
🎉 [BOT-MAINTENANCE] Mantenimiento completado exitosamente
```
