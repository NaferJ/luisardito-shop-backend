# Script para sincronizar migraciones en entornos donde las tablas ya existen
param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

function Register-ExistingMigrations {
    Write-Host "📝 Registrando migraciones iniciales como ejecutadas..." -ForegroundColor Yellow

    # Lista de migraciones a registrar
    $migrations = @(
        "20250101000001-create-auth-tables.js",
        "20250101000002-create-core-tables.js",
        "20250101000003-create-refresh-tokens.js",
        "20250101000004-create-kick-tables-1.js",
        "20250101000005-create-kick-tables-2.js"
    )

    # Conectar directamente a MySQL para insertar registros
    foreach ($migration in $migrations) {
        Write-Host "  ✅ Registrando: $migration" -ForegroundColor Green
        $query = "INSERT IGNORE INTO SequelizeMeta (name) VALUES ('$migration');"
        docker exec -i luisardito-mysql mysql -u app -papp luisardito_shop -e $query 2>$null
    }

    Write-Host "✅ Migraciones registradas correctamente" -ForegroundColor Green
}

function Check-Status {
    Write-Host "📊 Estado actual de las migraciones:" -ForegroundColor Cyan

    # Verificar directamente en la base de datos
    $query = "SELECT name FROM SequelizeMeta ORDER BY name;"
    docker exec -i luisardito-mysql mysql -u app -papp luisardito_shop -e $query
}

function Show-Help {
    Write-Host "🛠️  Script de sincronización de migraciones" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "Uso: .\sync-migrations.ps1 [comando]" -ForegroundColor White
    Write-Host ""
    Write-Host "Comandos disponibles:" -ForegroundColor Yellow
    Write-Host "  register  - Registra las migraciones iniciales como ejecutadas" -ForegroundColor Green
    Write-Host "  status    - Muestra el estado actual de las migraciones" -ForegroundColor Green
    Write-Host "  help      - Muestra esta ayuda" -ForegroundColor Green
    Write-Host ""
    Write-Host "Nota: Este script es para entornos donde las tablas ya existen" -ForegroundColor Cyan
    Write-Host "      pero las migraciones no están registradas." -ForegroundColor Cyan
}

# Función principal
switch ($Command.ToLower()) {
    "register" {
        Register-ExistingMigrations
    }
    "status" {
        Check-Status
    }
    default {
        Show-Help
    }
}
