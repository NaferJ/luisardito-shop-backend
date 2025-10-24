#!/bin/bash
# Script de rollback de emergencia para producción

echo "🚨 ROLLBACK DE EMERGENCIA - Migraciones"
echo "======================================"

# Función para hacer backup
backup_db() {
    echo "📦 Creando backup de emergencia..."
    mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME > "emergency_backup_$(date +%Y%m%d_%H%M%S).sql"
    echo "✅ Backup creado"
}

# Función para remover registros de migraciones problemáticas
rollback_migrations() {
    echo "🔄 Removiendo registros de migraciones problemáticas..."

    mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "
    DELETE FROM SequelizeMeta WHERE name IN (
        '20250101000001-create-auth-tables.js',
        '20250101000002-create-core-tables.js',
        '20250101000003-create-refresh-tokens.js',
        '20250101000004-create-kick-tables-1.js',
        '20250101000005-create-kick-tables-2.js'
    );
    "

    echo "✅ Registros removidos"
}

# Función para verificar estado
check_status() {
    echo "📊 Estado actual:"
    mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "SELECT * FROM SequelizeMeta ORDER BY name;"
}

# Menú principal
case "${1:-help}" in
    "backup")
        backup_db
        ;;
    "rollback")
        backup_db
        rollback_migrations
        check_status
        ;;
    "status")
        check_status
        ;;
    *)
        echo "Uso: $0 [backup|rollback|status]"
        echo ""
        echo "backup   - Crear backup de la base de datos"
        echo "rollback - Hacer rollback de migraciones + backup"
        echo "status   - Ver estado actual"
        ;;
esac
