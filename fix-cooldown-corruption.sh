#!/bin/bash

echo "🔧 Arreglando cooldown corrupto..."

echo "1️⃣ Limpiando cooldowns con fechas corruptas..."
docker exec luisardito-backend node clean-corrupted-cooldowns.js

echo ""
echo "2️⃣ Reiniciando backend con código mejorado..."
docker-compose restart luisardito-backend

echo ""
echo "3️⃣ Esperando que el backend se inicie..."
sleep 5

echo ""
echo "4️⃣ Verificando estado final..."
docker exec luisardito-backend node test-cooldown-simple.js

echo ""
echo "✅ Arreglo completado. Ahora:"
echo "   - Los cooldowns corruptos fueron eliminados"
echo "   - El código previene fechas futuras incorrectas"
echo "   - El cooldown debería funcionar correctamente"
echo ""
echo "🎯 Prueba escribiendo 3 mensajes rápidos:"
echo "   - El primer mensaje debería dar puntos"
echo "   - Los siguientes deberían mostrar 'BLOQUEADO por XXXs'"
