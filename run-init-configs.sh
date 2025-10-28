#!/bin/bash

# Script para ejecutar la inicialización de configuraciones dentro del contenedor

echo "🐳 Ejecutando inicialización de configuraciones dentro del contenedor..."

# Ejecutar el script dentro del contenedor de backend
docker exec luisardito-backend node init-kick-configs.js

echo ""
echo "✅ Inicialización completada. Verifica los logs arriba para confirmar que todo funcionó."
echo ""
echo "💡 Si ves errores, puedes revisar los logs del contenedor con:"
echo "   docker logs luisardito-backend"
