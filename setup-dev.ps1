# Luisardito Shop Backend - Development Setup Script (Windows PowerShell)
# Este script configura el entorno de desarrollo local en Windows

param(
    [switch]$CleanVolumes,
    [switch]$SkipPrompts
)

# Configuración de colores
$Host.UI.RawUI.WindowTitle = "Luisardito Shop - Development Setup"

function Write-ColorOutput($ForegroundColor, $Message) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    Write-Output $Message
    $host.UI.RawUI.ForegroundColor = $fc
}

function Log-Info($Message) {
    Write-ColorOutput Blue "[INFO] $Message"
}

function Log-Success($Message) {
    Write-ColorOutput Green "[SUCCESS] $Message"
}

function Log-Warning($Message) {
    Write-ColorOutput Yellow "[WARNING] $Message"
}

function Log-Error($Message) {
    Write-ColorOutput Red "[ERROR] $Message"
}

function Test-CommandExists($Command) {
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

function Check-Prerequisites {
    Log-Info "Verificando prerrequisitos..."

    # Verificar Docker
    if (-not (Test-CommandExists "docker")) {
        Log-Error "Docker no está instalado. Por favor instala Docker Desktop para Windows."
        exit 1
    }

    # Verificar Docker Compose
    if (-not (Test-CommandExists "docker-compose")) {
        Log-Error "Docker Compose no está instalado."
        exit 1
    }

    # Verificar Node.js
    if (-not (Test-CommandExists "node")) {
        Log-Warning "Node.js no está instalado. Se recomienda instalarlo para desarrollo local."
    } else {
        $nodeVersion = node --version
        Log-Success "Node.js encontrado: $nodeVersion"
    }

    # Verificar npm
    if (-not (Test-CommandExists "npm")) {
        Log-Warning "npm no está disponible."
    } else {
        $npmVersion = npm --version
        Log-Success "npm encontrado: $npmVersion"
    }

    Log-Success "Prerrequisitos verificados"
}

function Setup-Environment {
    Log-Info "Configurando archivo de entorno..."

    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.development") {
            Copy-Item ".env.development" ".env"
            Log-Success "Archivo .env creado desde .env.development"
        } elseif (Test-Path ".env.template") {
            Copy-Item ".env.template" ".env"
            Log-Success "Archivo .env creado desde .env.template"
        } else {
            Log-Error "No se encontró archivo de plantilla para .env"
            exit 1
        }
    } else {
        Log-Warning "El archivo .env ya existe, no se sobrescribirá"
    }

    Log-Warning "IMPORTANTE: Revisa y actualiza las siguientes variables en .env:"
    Write-Output "  - JWT_SECRET (genera una clave segura)"
    Write-Output "  - KICK_CLIENT_ID (tus credenciales de desarrollo)"
    Write-Output "  - KICK_CLIENT_SECRET (tus credenciales de desarrollo)"
}

function Install-Dependencies {
    if (Test-CommandExists "npm") {
        Log-Info "Instalando dependencias de Node.js..."
        npm install
        if ($LASTEXITCODE -eq 0) {
            Log-Success "Dependencias instaladas"
        } else {
            Log-Error "Error al instalar dependencias"
            exit 1
        }
    } else {
        Log-Warning "npm no disponible, las dependencias se instalarán en Docker"
    }
}

function Cleanup-Containers {
    Log-Info "Limpiando contenedores existentes..."

    # Verificar si hay contenedores corriendo
    $runningContainers = docker-compose ps --services --filter "status=running" 2>$null
    if ($runningContainers) {
        Log-Info "Deteniendo contenedores existentes..."
        docker-compose down
    }

    # Limpiar volúmenes si se especifica o se pregunta
    if ($CleanVolumes -or (-not $SkipPrompts -and (Read-Host "¿Quieres limpiar volúmenes existentes de la base de datos? (esto eliminará todos los datos) [y/N]") -match '^[Yy]$')) {
        docker-compose down -v
        Log-Warning "Volúmenes eliminados - se perderán todos los datos existentes"
    }
}

function Start-Services {
    Log-Info "Iniciando servicios de desarrollo..."

    # Iniciar solo la base de datos
    docker-compose up -d db
    if ($LASTEXITCODE -ne 0) {
        Log-Error "Error al iniciar la base de datos"
        exit 1
    }

    Log-Info "Esperando que la base de datos esté lista..."
    Start-Sleep -Seconds 15

    # Verificar que la DB esté saludable
    $maxAttempts = 30
    $attempt = 1
    $dbReady = $false

    while ($attempt -le $maxAttempts -and -not $dbReady) {
        try {
            docker-compose exec -T db mysqladmin ping -h localhost --silent 2>$null
            if ($LASTEXITCODE -eq 0) {
                $dbReady = $true
                Log-Success "Base de datos lista"
            } else {
                Log-Info "Esperando base de datos... intento $attempt/$maxAttempts"
                Start-Sleep -Seconds 2
                $attempt++
            }
        }
        catch {
            Log-Info "Esperando base de datos... intento $attempt/$maxAttempts"
            Start-Sleep -Seconds 2
            $attempt++
        }
    }

    if (-not $dbReady) {
        Log-Error "La base de datos no respondió a tiempo"
        exit 1
    }
}

function Setup-Database {
    Log-Info "Configurando base de datos..."

    # Ejecutar migraciones
    Log-Info "Ejecutando migraciones..."
    if (Test-CommandExists "npm") {
        npm run migrate
        if ($LASTEXITCODE -ne 0) {
            Log-Warning "Las migraciones fallaron"
        }
    } else {
        # Crear base de datos manualmente si npm no está disponible
        docker-compose exec -T db mysql -u app -papp -e "CREATE DATABASE IF NOT EXISTS luisardito_shop;" 2>$null
        Log-Info "Base de datos creada (sin migraciones por falta de npm local)"
    }

    # Ejecutar seeders
    Log-Info "Ejecutando seeders..."
    if (Test-CommandExists "npm") {
        npm run seed
        if ($LASTEXITCODE -ne 0) {
            Log-Warning "Los seeders fallaron o no existen"
        }
    } else {
        Log-Warning "Seeders no ejecutados (npm no disponible localmente)"
    }

    Log-Success "Base de datos configurada"
}

function Show-FinalInfo {
    Write-Output ""
    Write-Output "=================================================================="
    Log-Success "🎉 ¡Setup de desarrollo completado!"
    Write-Output "=================================================================="
    Write-Output ""
    Write-Output "📍 Información de conexión:"
    Write-Output "   • API: http://localhost:3001"
    Write-Output "   • Base de datos: localhost:3307"
    Write-Output "     - Usuario: app"
    Write-Output "     - Contraseña: app"
    Write-Output "     - Base de datos: luisardito_shop"
    Write-Output ""
    Write-Output "🚀 Comandos para desarrollar:"
    Write-Output "   • Desarrollo completo: npm run docker:dev"
    Write-Output "   • Solo API local:       npm run dev:local (requiere DB en Docker)"
    Write-Output "   • Ver logs:             npm run docker:dev:logs"
    Write-Output "   • Detener servicios:    npm run docker:dev:down"
    Write-Output ""
    Write-Output "📚 Para más información, revisa DEVELOPMENT.md"
    Write-Output ""
    Log-Warning "No olvides actualizar las variables de entorno en .env"
}

# Función principal
function Main {
    Write-Output ""
    Write-Output "🚀 Configurando entorno de desarrollo para Luisardito Shop Backend..."
    Write-Output "=================================================================="
    Write-Output ""

    try {
        Check-Prerequisites
        Setup-Environment
        Install-Dependencies
        Cleanup-Containers
        Start-Services
        Setup-Database
        Show-FinalInfo

        Write-Output ""
        Log-Success "¡Setup completado! Ya puedes comenzar a desarrollar."
        Write-Output ""

        if (-not $SkipPrompts) {
            $startNow = Read-Host "¿Quieres iniciar el entorno de desarrollo ahora? [y/N]"
            if ($startNow -match '^[Yy]$') {
                Log-Info "Iniciando entorno de desarrollo..."
                docker-compose up --build
            } else {
                Log-Info "Para iniciar más tarde, ejecuta: npm run docker:dev"
            }
        }
    }
    catch {
        Log-Error "Error durante el setup: $($_.Exception.Message)"
        exit 1
    }
}

# Manejar Ctrl+C
$null = Register-EngineEvent PowerShell.Exiting -Action {
    Log-Error "Setup interrumpido por el usuario"
}

# Ejecutar función principal
Main
