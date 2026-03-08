#!/bin/bash
# Script para probar un backup manual y ver los errores

echo "🔍 Probando backup manual..."
echo ""

echo "1️⃣ Verificando permisos de Docker socket dentro del contenedor:"
docker exec luisardito-backend ls -la /var/run/docker.sock
echo ""

echo "2️⃣ Verificando si puede ejecutar docker commands:"
docker exec luisardito-backend docker ps 2>&1 || echo "❌ No puede ejecutar docker commands"
echo ""

echo "3️⃣ Probando comando mysqldump directo:"
docker exec luisardito-backend docker exec luisardito-mysql mysqldump -u root -p77bf088ed8c060d568b69b5263837423f779ce69d277cd7ab1691ab6fc53081e --single-transaction --routines --triggers --events luisardito_shop 2>&1 | head -20
echo ""

echo "4️⃣ Logs detallados del último intento de backup:"
docker logs luisardito-backend 2>&1 | grep -A 10 "Ejecutando backup programado"
echo ""

