#!/bin/bash

# Luisardito Shop Backend - Development Setup Script
# Este script configura el entorno de desarrollo local

set -e

echo "🚀 Configurando entorno de desarrollo para Luisardito Shop Backend..."
echo "=================================================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar prerrequisitos
check_prerequisites() {
    log_info "Verificando prerrequisitos..."

    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker no está instalado. Por favor instala Docker Desktop."
        exit 1
    fi

    # Verificar Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose no está instalado."
        exit 1
    fi

    # Verificar Node.js
    if ! command -v node &> /dev/null; then
        log_warning "Node.js no está instalado. Se recomienda instalarlo para desarrollo local."
    else
        NODE_VERSION=$(node --version)
        log_success "Node.js encontrado: $NODE_VERSION"
    fi

    # Verificar npm
    if ! command -v npm &> /dev/null; then
        log_warning "npm no está disponible."
    else
        NPM_VERSION=$(npm --version)
        log_success "npm encontrado: $NPM_VERSION"
    fi

    log_success "Prerrequisitos verificados"
}

# Configurar archivo .env
setup_env() {
    log_info "Configurando archivo de entorno..."

    if [ ! -f ".env" ]; then
        if [ -f ".env.development" ]; then
            cp .env.development .env
            log_success "Archivo .env creado desde .env.development"
        elif [ -f ".env.template" ]; then
            cp .env.template .env
            log_success "Archivo .env creado desde .env.template"
        else
            log_error "No se encontró archivo de plantilla para .env"
            exit 1
        fi
    else
        log_warning "El archivo .env ya existe, no se sobrescribirá"
    fi

    log_warning "IMPORTANTE: Revisa y actualiza las siguientes variables en .env:"
    echo "  - JWT_SECRET (genera una clave segura)"
    echo "  - KICK_CLIENT_ID (tus credenciales de desarrollo)"
    echo "  - KICK_CLIENT_SECRET (tus credenciales de desarrollo)"
}

# Instalar dependencias
install_dependencies() {
    if command -v npm &> /dev/null; then
        log_info "Instalando dependencias de Node.js..."
        npm install
        log_success "Dependencias instaladas"
    else
        log_warning "npm no disponible, las dependencias se instalarán en Docker"
    fi
}

# Verificar y limpiar contenedores existentes
cleanup_containers() {
    log_info "Limpiando contenedores existentes..."

    # Detener contenedores si están corriendo
    if docker-compose ps | grep -q "luisardito"; then
        log_info "Deteniendo contenedores existentes..."
        docker-compose down
    fi

    # Limpiar volúmenes huérfanos (opcional)
    read -p "¿Quieres limpiar volúmenes existentes de la base de datos? (esto eliminará todos los datos) [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down -v
        log_warning "Volúmenes eliminados - se perderán todos los datos existentes"
    fi
}

# Iniciar servicios
start_services() {
    log_info "Iniciando servicios de desarrollo..."

    # Iniciar en modo detached
    docker-compose up -d db

    log_info "Esperando que la base de datos esté lista..."
    sleep 15

    # Verificar que la DB esté saludable
    max_attempts=30
    attempt=1
    while [ $attempt -le $max_attempts ]; do
        if docker-compose exec -T db mysqladmin ping -h localhost --silent; then
            log_success "Base de datos lista"
            break
        fi
        log_info "Esperando base de datos... intento $attempt/$max_attempts"
        sleep 2
        attempt=$((attempt + 1))
    done

    if [ $attempt -gt $max_attempts ]; then
        log_error "La base de datos no respondió a tiempo"
        exit 1
    fi
}

# Configurar base de datos
setup_database() {
    log_info "Configurando base de datos..."

    # Ejecutar migraciones
    log_info "Ejecutando migraciones..."
    if command -v npm &> /dev/null; then
        npm run migrate
    else
        docker-compose exec -T db mysql -u app -papp -e "CREATE DATABASE IF NOT EXISTS luisardito_shop;"
        log_info "Base de datos creada (sin migraciones por falta de npm local)"
    fi

    # Ejecutar seeders
    log_info "Ejecutando seeders..."
    if command -v npm &> /dev/null; then
        npm run seed || log_warning "Los seeders fallaron o no existen"
    else
        log_warning "Seeders no ejecutados (npm no disponible localmente)"
    fi

    log_success "Base de datos configurada"
}

# Mostrar información final
show_final_info() {
    echo
    echo "=================================================================="
    log_success "🎉 ¡Setup de desarrollo completado!"
    echo "=================================================================="
    echo
    echo "📍 Información de conexión:"
    echo "   • API: http://localhost:3001"
    echo "   • Base de datos: localhost:3307"
    echo "     - Usuario: app"
    echo "     - Contraseña: app"
    echo "     - Base de datos: luisardito_shop"
    echo
    echo "🚀 Comandos para desarrollar:"
    echo "   • Desarrollo completo: npm run docker:dev"
    echo "   • Solo API local:       npm run dev:local (requiere DB en Docker)"
    echo "   • Ver logs:             npm run docker:dev:logs"
    echo "   • Detener servicios:    npm run docker:dev:down"
    echo
    echo "📚 Para más información, revisa DEVELOPMENT.md"
    echo
    log_warning "No olvides actualizar las variables de entorno en .env"
}

# Función principal
main() {
    echo
    log_info "Iniciando setup de desarrollo..."
    echo

    check_prerequisites
    setup_env
    install_dependencies
    cleanup_containers
    start_services
    setup_database
    show_final_info

    echo
    log_success "¡Setup completado! Ya puedes comenzar a desarrollar."
    echo

    read -p "¿Quieres iniciar el entorno de desarrollo ahora? [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Iniciando entorno de desarrollo..."
        docker-compose up --build
    else
        log_info "Para iniciar más tarde, ejecuta: npm run docker:dev"
    fi
}

# Manejar interrupciones
trap 'log_error "Setup interrumpido por el usuario"; exit 1' INT TERM

# Ejecutar función principal
main "$@"
