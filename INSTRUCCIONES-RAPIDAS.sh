#!/bin/bash

# 🚀 INSTRUCCIONES RÁPIDAS - ARREGLAR CONFIGURACIÓN DE KICK

echo "🔧 Solucionando problemas de configuración de Kick..."
echo ""
echo "📋 PASOS A SEGUIR:"
echo ""
echo "1️⃣  Ejecuta este comando en tu servidor:"
echo "    bash run-init-configs.sh"
echo ""
echo "2️⃣  Si el paso 1 falla, ejecuta esto:"
echo "    docker exec luisardito-backend node init-kick-configs.js"
echo ""
echo "3️⃣  Reinicia el backend:"
echo "    docker-compose restart luisardito-backend"
echo ""
echo "4️⃣  Verifica que funcione en el frontend"
echo ""
echo "💡 Problemas que esto soluciona:"
echo "   ❌ Error 'migration_enabled debe ser un booleano'"
echo "   ❌ Error al cargar configuración de puntos"
echo "   ❌ Configuración no encontrada"
echo ""
echo "🔍 Para verificar que funcionó:"
echo "   curl http://localhost:3001/api/kick/points-config"
echo ""

# Si se pasa el parámetro --run, ejecutar automáticamente
if [ "$1" = "--run" ]; then
    echo "🚀 Ejecutando automáticamente..."
    echo ""

    # Verificar que el contenedor esté corriendo
    if ! docker ps | grep -q luisardito-backend; then
        echo "❌ Error: El contenedor luisardito-backend no está corriendo"
        echo "💡 Inicia el stack con: docker-compose up -d"
        exit 1
    fi

    # Ejecutar la inicialización
    echo "📦 Inicializando configuraciones..."
    docker exec luisardito-backend node init-kick-configs.js

    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ ¡Configuraciones inicializadas exitosamente!"
        echo "💡 Ahora puedes probar el frontend"
    else
        echo ""
        echo "❌ Error durante la inicialización"
        echo "🔍 Revisa los logs con: docker logs luisardito-backend"
    fi
fi
