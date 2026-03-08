#!/bin/bash
# Script para desplegar el fix de backups

echo "Desplegando fix de backups..."
echo ""

echo "1. Haciendo pull de los cambios..."
git pull
echo ""

echo "2. Reconstruyendo la imagen..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml build api
echo ""

echo "3. Aplicando cambios sin downtime..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d api
echo ""

echo "4. Esperando a que el contenedor este listo..."
sleep 10
echo ""

echo "5. Verificando logs de inicio:"
docker logs luisardito-backend 2>&1 | grep -i "scheduler\|backup" | tail -10
echo ""

echo "6. Probando un backup manual..."
docker exec luisardito-backend node -e "
const backupScheduler = require('./src/services/backup.task');
backupScheduler.runManualBackup().then(result => {
    console.log('Resultado:', JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
}).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
"
echo ""

echo "7. Verificando el archivo creado:"
ls -lh ./backups/local/ | tail -3
echo ""

echo "Despliegue completado"

