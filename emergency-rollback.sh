#!/bin/bash
# Script de rollback de emergencia para producción

echo "🚨 ROLLBACK DE EMERGENCIA - Migraciones"
echo "======================================"
echo "ℹ️  Si hay errores 'Unknown column puntos', ejecutar:"
echo "   npx sequelize-cli db:migrate --to 20251024000001-emergency-add-puntos-column.js"
echo ""

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

# Función para aplicar migración de emergencia (columna puntos)
apply_emergency_migration() {
    echo "🔧 Aplicando migración de emergencia para columna puntos..."
    npx sequelize-cli db:migrate --to 20251024000001-emergency-add-puntos-column.js
    if [ $? -eq 0 ]; then
        echo "✅ Migración de emergencia aplicada correctamente"
    else
        echo "❌ Error aplicando migración de emergencia"
        exit 1
    fi
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
    "fix-puntos")
        backup_db
        apply_emergency_migration
        check_status
        ;;
    "status")
        check_status
        ;;
    *)
        echo "Uso: $0 [backup|rollback|fix-puntos|status]"
        echo ""
        echo "backup     - Crear backup de la base de datos"
        echo "rollback   - Hacer rollback de migraciones + backup"
        echo "fix-puntos - Aplicar migración de emergencia para columna puntos"
        echo "status     - Ver estado actual"
        echo ""
        echo "🔧 PROBLEMA ESPECÍFICO: Error 'Unknown column puntos'"
        echo "   Si ves este error, ejecuta: $0 fix-puntos"
        ;;
esac
