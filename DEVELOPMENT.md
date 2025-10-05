# Guía de Desarrollo Local

Este documento te guiará para configurar y ejecutar el proyecto en tu máquina local para desarrollo.

## Prerrequisitos

- Docker y Docker Compose instalados
- Node.js 18+ (para desarrollo sin Docker)
- Git

## Configuración Inicial

### 1. Clonar el repositorio
```bash
git clone <repository-url>
cd luisardito-shop-backend
```

### 2. Configurar variables de entorno
Copia el archivo de configuración de desarrollo:
```bash
cp .env.development .env
```

**Importante**: Edita el archivo `.env` y actualiza las siguientes variables con tus valores reales:
- `JWT_SECRET`: Genera una clave secreta fuerte
- `KICK_CLIENT_ID`: Tu Client ID de desarrollo de Kick
- `KICK_CLIENT_SECRET`: Tu Client Secret de desarrollo de Kick

### 3. Instalar dependencias
```bash
npm install
```

## Métodos de Desarrollo

### Opción 1: Desarrollo con Docker (Recomendado)

**Ventajas:**
- Mismo entorno que producción (MySQL 8.0)
- No interfiere con tu MySQL local
- Setup automático de base de datos
- Aislamiento completo

**Comandos:**
```bash
# Levantar todo el entorno (base de datos + API)
npm run docker:dev

# Ver logs en tiempo real
npm run docker:dev:logs

# Detener el entorno
npm run docker:dev:down

# Resetear base de datos completamente
docker-compose down -v && npm run docker:dev
```

**URLs de acceso:**
- API: http://localhost:3001
- Base de datos: localhost:3307 (desde herramientas externas como MySQL Workbench)

### Opción 2: Desarrollo Híbrido (Solo DB en Docker)

Si prefieres ejecutar la API directamente en tu máquina:

```bash
# 1. Levantar solo la base de datos
npm run docker:db

# 2. Configurar base de datos (primera vez)
npm run dev:setup

# 3. Ejecutar API en modo desarrollo
npm run dev:local
```

## Comandos Útiles

### Base de Datos
```bash
# Ejecutar migraciones
npm run migrate

# Ejecutar seeders
npm run seed

# Configurar DB desde cero
npm run setup-db

# Resetear base de datos
npm run reset-db

# Resetear con Docker
npm run dev:reset
```

### Docker
```bash
# Ver contenedores activos
docker-compose ps

# Acceder al contenedor de la API
docker-compose exec api bash

# Acceder a MySQL
docker-compose exec db mysql -u app -papp luisardito_shop

# Ver logs
docker-compose logs -f [servicio]
```

## Estructura del Proyecto

```
luisardito-shop-backend/
├── src/                    # Código fuente
├── migrations/             # Migraciones de base de datos
├── seeders/               # Datos iniciales
├── .env.development       # Configuración de desarrollo
├── docker-compose.yml     # Configuración base de Docker
├── docker-compose.override.yml # Configuración específica de desarrollo
└── package.json
```

## Troubleshooting

### Problemas Comunes

**Error de conexión a base de datos:**
```bash
# Verificar que el contenedor está corriendo
docker-compose ps

# Reiniciar base de datos
docker-compose restart db

# Verificar logs de la base de datos
docker-compose logs db
```

**Puerto ocupado:**
```bash
# Verificar qué está usando el puerto 3001 o 3307
netstat -ano | findstr :3001
netstat -ano | findstr :3307

# Cambiar puertos en docker-compose.override.yml si es necesario
```

**Problemas de permisos con volúmenes:**
```bash
# Limpiar volúmenes
docker-compose down -v
docker volume prune
```

**Migraciones no se ejecutan:**
```bash
# Ejecutar manualmente
docker-compose exec api npx sequelize db:migrate

# O desde local si tienes la DB en Docker
npm run migrate
```

### Diferencias con Producción

| Aspecto | Desarrollo | Producción |
|---------|------------|------------|
| Base de datos | MySQL 8.0 (Docker) | MySQL 8.0 (Servidor) |
| Puerto API | 3001 | Depende del deploy |
| Puerto DB | 3307 (host) | 3306 |
| SSL | Deshabilitado | Habilitado |
| Logs | Verbose | Limitados |
| Hot reload | Habilitado | Deshabilitado |

## Tips de Desarrollo

1. **Hot Reload**: Los cambios en el código se reflejan automáticamente
2. **Logs**: Usa `npm run docker:dev:logs` para ver logs en tiempo real
3. **Base de datos**: Puedes conectarte con herramientas como MySQL Workbench usando `localhost:3307`
4. **Testing**: Crea datos de prueba usando seeders
5. **Debugging**: Agrega `console.log` o usa un debugger, los logs aparecerán en la consola

## Variables de Entorno Importantes

```env
# Base de datos (no cambiar para Docker)
DB_HOST=localhost
DB_PORT=3307
DB_USER=app
DB_PASSWORD=app
DB_NAME=luisardito_shop

# Autenticación (CAMBIAR EN DESARROLLO)
JWT_SECRET=tu-clave-secreta-local

# OAuth Kick (usar credenciales de desarrollo)
KICK_CLIENT_ID=tu-client-id-dev
KICK_CLIENT_SECRET=tu-client-secret-dev
KICK_REDIRECT_URI=http://localhost:3001/auth/kick/callback
```

## Próximos Pasos

1. Configura tus credenciales de desarrollo de Kick
2. Crea migraciones y seeders según necesites
3. Desarrolla y prueba localmente
4. Haz commit de tus cambios (sin incluir archivos .env)
