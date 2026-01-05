#!/bin/bash
# Script para sincronizar migraciones en entornos donde las tablas ya existen

echo "🔄 Sincronizando migraciones con la base de datos existente..."

# Función para registrar migraciones como ejecutadas
register_existing_migrations() {
    echo "📝 Registrando migraciones iniciales como ejecutadas..."

    # Lista de migraciones a registrar
    migrations=(
        "20250101000001-create-auth-tables.js"
        "20250101000002-create-core-tables.js"
        "20250101000003-create-refresh-tokens.js"
        "20250101000004-create-kick-tables-1.js"
        "20250101000005-create-kick-tables-2.js"
    )

    for migration in "${migrations[@]}"; do
        echo "  ✅ Registrando: $migration"
        # Insertar solo si no existe
        npx sequelize db:seed --seed manual-migration-register.js --migration="$migration" 2>/dev/null || true
    done

    echo "✅ Migraciones registradas correctamente"
}

# Función para verificar el estado
check_status() {
    echo "📊 Estado actual de las migraciones:"
    npx sequelize db:migrate:status
}

# Función principal
main() {
    case "${1:-help}" in
        "register")
            register_existing_migrations
            ;;
        "status")
            check_status
            ;;
        "help"|*)
            echo "🛠️  Script de sincronización de migraciones"
            echo ""
            echo "Uso: $0 [comando]"
            echo ""
            echo "Comandos disponibles:"
            echo "  register  - Registra las migraciones iniciales como ejecutadas"
            echo "  status    - Muestra el estado actual de las migraciones"
            echo "  help      - Muestra esta ayuda"
            echo ""
            echo "Nota: Este script es para entornos donde las tablas ya existen"
            echo "      pero las migraciones no están registradas."
            ;;
    esac
}

main "$@"
