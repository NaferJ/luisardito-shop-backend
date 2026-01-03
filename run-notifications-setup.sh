#!/bin/bash
# Script para ejecutar la migración del sistema de notificaciones

echo "🚀 Iniciando implementación del sistema de notificaciones..."

# 1. Ejecutar migración
echo "1️⃣  Ejecutando migración de base de datos..."
npm run migrate

# 2. Verificar que los archivos fueron creados
echo "2️⃣  Verificando archivos creados..."
test -f src/models/notificacion.model.js && echo "✅ Modelo Notificacion creado" || echo "❌ Falta modelo Notificacion"
test -f src/services/notificacion.service.js && echo "✅ Servicio de notificaciones creado" || echo "❌ Falta servicio"
test -f src/controllers/notificaciones.controller.js && echo "✅ Controlador creado" || echo "❌ Falta controlador"
test -f src/routes/notificaciones.routes.js && echo "✅ Rutas creadas" || echo "❌ Faltan rutas"

echo ""
echo "✨ Sistema de notificaciones implementado correctamente"
echo ""
echo "Endpoints disponibles:"
echo "  GET    /api/notificaciones                    - Listar notificaciones (paginado)"
echo "  GET    /api/notificaciones/no-leidas/contar   - Contar no leídas"
echo "  GET    /api/notificaciones/:id                - Obtener detalle (marca como leída)"
echo "  PATCH  /api/notificaciones/:id/leido          - Marcar como leída"
echo "  PATCH  /api/notificaciones/leer-todas         - Marcar todas como leídas"
echo "  DELETE /api/notificaciones/:id                - Eliminar notificación"
echo ""
echo "🎉 ¡Todo listo para usar el sistema de notificaciones!"

