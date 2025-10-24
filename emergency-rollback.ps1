# Script de rollback de emergencia para Windows PowerShell

param(
    [string]$Action = "help"
)

Write-Host "🚨 ROLLBACK DE EMERGENCIA - Migraciones" -ForegroundColor Red
Write-Host "======================================" -ForegroundColor Red
Write-Host "ℹ️  Si hay errores 'Unknown column puntos', ejecutar:" -ForegroundColor Yellow
Write-Host "   .\emergency-rollback.ps1 fix-puntos" -ForegroundColor Cyan
Write-Host ""

# Función para hacer backup
function Backup-Database {
    Write-Host "📦 Creando backup de emergencia..." -ForegroundColor Blue
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = "emergency_backup_$timestamp.sql"

    if ($env:DB_USER -and $env:DB_PASSWORD -and $env:DB_NAME) {
        & mysqldump -u $env:DB_USER -p$env:DB_PASSWORD $env:DB_NAME > $backupFile
        Write-Host "✅ Backup creado: $backupFile" -ForegroundColor Green
    } else {
        Write-Host "❌ Faltan variables de entorno de BD (DB_USER, DB_PASSWORD, DB_NAME)" -ForegroundColor Red
        exit 1
    }
}

# Función para remover registros de migraciones problemáticas
function Rollback-Migrations {
    Write-Host "🔄 Removiendo registros de migraciones problemáticas..." -ForegroundColor Blue

    $query = @"
    DELETE FROM SequelizeMeta WHERE name IN (
        '20250101000001-create-auth-tables.js',
        '20250101000002-create-core-tables.js',
        '20250101000003-create-refresh-tokens.js',
        '20250101000004-create-kick-tables-1.js',
        '20250101000005-create-kick-tables-2.js'
    );
"@

    & mysql -u $env:DB_USER -p$env:DB_PASSWORD $env:DB_NAME -e $query
    Write-Host "✅ Registros removidos" -ForegroundColor Green
}

# Función para aplicar migración de emergencia (columna puntos)
function Apply-EmergencyMigration {
    Write-Host "🔧 Aplicando migración de emergencia para columna puntos..." -ForegroundColor Blue

    & npx sequelize-cli db:migrate --to 20251024000001-emergency-add-puntos-column.js

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migración de emergencia aplicada correctamente" -ForegroundColor Green
    } else {
        Write-Host "❌ Error aplicando migración de emergencia" -ForegroundColor Red
        exit 1
    }
}

# Función para verificar estado
function Check-Status {
    Write-Host "📊 Estado actual:" -ForegroundColor Blue
    & mysql -u $env:DB_USER -p$env:DB_PASSWORD $env:DB_NAME -e "SELECT * FROM SequelizeMeta ORDER BY name;"
}

# Menú principal
switch ($Action.ToLower()) {
    "backup" {
        Backup-Database
    }
    "rollback" {
        Backup-Database
        Rollback-Migrations
        Check-Status
    }
    "fix-puntos" {
        Backup-Database
        Apply-EmergencyMigration
        Check-Status
    }
    "status" {
        Check-Status
    }
    default {
        Write-Host "Uso: .\emergency-rollback.ps1 [backup|rollback|fix-puntos|status]" -ForegroundColor White
        Write-Host ""
        Write-Host "backup     - Crear backup de la base de datos" -ForegroundColor Gray
        Write-Host "rollback   - Hacer rollback de migraciones + backup" -ForegroundColor Gray
        Write-Host "fix-puntos - Aplicar migración de emergencia para columna puntos" -ForegroundColor Gray
        Write-Host "status     - Ver estado actual" -ForegroundColor Gray
        Write-Host ""
        Write-Host "🔧 PROBLEMA ESPECÍFICO: Error 'Unknown column puntos'" -ForegroundColor Yellow
        Write-Host "   Si ves este error, ejecuta: .\emergency-rollback.ps1 fix-puntos" -ForegroundColor Cyan
    }
}
