#!/bin/bash
# Script de backup que se ejecuta en el HOST (no dentro del contenedor)
# Uso: ./backup-host.sh

set -e

TIMESTAMP=$(date +%Y-%m-%dT%H-%M-%S)
BACKUP_DIR="./backups/local"
GITHUB_DIR="./backups/github"
FILENAME="backup-${TIMESTAMP}.sql"
GZ_FILENAME="${FILENAME}.gz"

echo "🔄 Iniciando backup de base de datos..."

# Crear directorios si no existen
mkdir -p "$BACKUP_DIR"
mkdir -p "$GITHUB_DIR"

# 1. Crear backup usando docker exec (desde el host)
echo "📦 Creando dump de MySQL..."
docker exec luisardito-mysql mysqldump \
    -u root \
    -proot \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    luisardito_shop > "$BACKUP_DIR/$FILENAME"

# 2. Comprimir
echo "🗜️ Comprimiendo backup..."
gzip "$BACKUP_DIR/$FILENAME"

# 3. Obtener tamaño
SIZE=$(du -h "$BACKUP_DIR/$GZ_FILENAME" | cut -f1)
echo "✅ Backup creado: $GZ_FILENAME ($SIZE)"

# 4. Subir a GitHub (si está configurado)
if [ -d "$GITHUB_DIR/.git" ]; then
    echo "☁️ Subiendo a GitHub..."
    
    YEAR=$(date +%Y)
    MONTH=$(date +%m)
    DEST_DIR="$GITHUB_DIR/$YEAR/$MONTH"
    
    mkdir -p "$DEST_DIR"
    cp "$BACKUP_DIR/$GZ_FILENAME" "$DEST_DIR/"
    
    cd "$GITHUB_DIR"
    git add "$YEAR/$MONTH/$GZ_FILENAME"
    git commit -m "Backup automático: $GZ_FILENAME"
    git push origin main
    
    echo "✅ Backup subido a GitHub"
    cd - > /dev/null
else
    echo "⚠️ Repositorio GitHub no inicializado, saltando subida"
fi

# 5. Limpiar backups antiguos (mantener últimos 3)
echo "🧹 Limpiando backups antiguos..."
cd "$BACKUP_DIR"
ls -t backup-*.sql.gz | tail -n +4 | xargs -r rm
echo "✅ Proceso completado"
