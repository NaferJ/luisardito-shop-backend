# Sync migrations in environments where tables already exist but migrations are not registered.
param(
    [Parameter(Position = 0)]
    [string]$Command = "help"
)

function Register-ExistingMigrations {
    Write-Host "Registering initial migrations as executed..." -ForegroundColor Yellow

    $migrations = @(
        "20250101000001-create-auth-tables.js",
        "20250101000002-create-core-tables.js",
        "20250101000003-create-refresh-tokens.js",
        "20250101000004-create-kick-tables-1.js",
        "20250101000005-create-kick-tables-2.js"
    )

    foreach ($migration in $migrations) {
        Write-Host "  Registering: $migration" -ForegroundColor Green
        $query = "INSERT IGNORE INTO SequelizeMeta (name) VALUES ('$migration');"
        docker exec -i luisardito-mysql mysql -u app -papp luisardito_shop -e $query 2>$null
    }

    Write-Host "Migrations registered successfully" -ForegroundColor Green
}

function Check-Status {
    Write-Host "Current migration status:" -ForegroundColor Cyan
    $query = "SELECT name FROM SequelizeMeta ORDER BY name;"
    docker exec -i luisardito-mysql mysql -u app -papp luisardito_shop -e $query
}

function Show-Help {
    Write-Host "Migration sync script" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "Usage: .\sync-migrations.ps1 [command]" -ForegroundColor White
    Write-Host ""
    Write-Host "Available commands:" -ForegroundColor Yellow
    Write-Host "  register  - Register initial migrations as executed" -ForegroundColor Green
    Write-Host "  status    - Show current migration status" -ForegroundColor Green
    Write-Host "  help      - Show this help" -ForegroundColor Green
    Write-Host ""
    Write-Host "Note: This script is for environments where tables already exist" -ForegroundColor Cyan
    Write-Host "      but migrations are not registered." -ForegroundColor Cyan
}

switch ($Command.ToLower()) {
    "register" { Register-ExistingMigrations }
    "status" { Check-Status }
    default { Show-Help }
}
