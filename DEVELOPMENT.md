# Guía de Desarrollo - Luisardito Shop Backend

## 🚀 Configuración Inicial

### Prerrequisitos
- Node.js 18+
- Docker y Docker Compose
- Git

### Setup del Proyecto
```bash
# Clonar el repositorio
git clone <repo-url>
cd luisardito-shop-backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env  # Ajustar según sea necesario

# Levantar la base de datos
npm run docker:db

# Esperar que MySQL esté listo y configurar DB
npm run dev:setup
```

## 📊 Base de Datos y Migraciones

### ✅ Estado Actual de Migraciones
**PROBLEMA RESUELTO**: Las migraciones ahora están completamente sincronizadas con la estructura actual de la base de datos.

### Migraciones Disponibles
1. **20250101000001-create-auth-tables.js** - Tablas de autenticación
2. **20250101000002-create-core-tables.js** - Tablas principales del sistema
3. **20250101000003-create-refresh-tokens.js** - Sistema de refresh tokens
4. **20250101000004-create-kick-tables-1.js** - Integración con Kick (parte 1)
5. **20250101000005-create-kick-tables-2.js** - Integración con Kick (parte 2)
6. **20251011011630-allow-null-password-hash.js** - Soporte para usuarios OAuth

### Comandos de Base de Datos

```bash
# Ver estado de migraciones
npm run migrate:status

# Ejecutar migraciones pendientes
npm run migrate

# Ejecutar seeders
npm run seed

# Setup completo (migraciones + seeders)
npm run setup-db

# Reset completo de la DB
npm run reset-db

# Deshacer última migración
npm run migrate:undo

# Deshacer todas las migraciones
npm run migrate:undo:all
```

### Para Entornos de Producción

Si necesitas sincronizar migraciones en un entorno donde las tablas ya existen:

```powershell
# Windows
.\sync-migrations.ps1 register
.\sync-migrations.ps1 status
```

```bash
# Linux/Mac
./sync-migrations.sh register
./sync-migrations.sh status
```

## 🐳 Docker

### Comandos Útiles
```bash
# Desarrollo completo con Docker
npm run docker:dev

# Solo base de datos
npm run docker:db

# Ver logs del API
npm run docker:dev:logs

# Bajar contenedores
npm run docker:dev:down

# Reset completo con Docker
npm run dev:reset
```

### Configuración de Puertos
- **API**: Puerto 3001 (mapeado desde 3000 interno)
- **MySQL**: Puerto 3307 (mapeado desde 3306 interno)

## 🏗️ Estructura del Proyecto

### Modelos Principales
- **Usuarios**: Sistema híbrido (local + Kick OAuth)
- **Productos**: Catálogo para sistema de puntos
- **Canjes**: Historial de intercambios
- **Puntos**: Sistema de recompensas completo

### Integración con Kick
- **OAuth**: Autenticación con Kick
- **Webhooks**: Eventos en tiempo real
- **Puntos**: Sistema automático por chat, follows, subs
- **Tracking**: Seguimiento detallado de usuarios

## 🔧 Desarrollo

### Crear Nueva Migración
```bash
# Generar nueva migración
npx sequelize migration:generate --name descripcion-del-cambio

# Editar el archivo generado en migrations/
# Implementar métodos up() y down()

# Ejecutar la migración
npm run migrate
```

### Crear Nuevo Seeder
```bash
# Generar seeder
npx sequelize seed:generate --name nombre-del-seeder

# Editar archivo en seeders/
# Ejecutar seeders
npm run seed
```

### Estructura de Archivos
```
src/
├── controllers/     # Lógica de negocio
├── middleware/      # Middlewares (auth, permisos)
├── models/          # Modelos de Sequelize
├── routes/          # Definición de rutas
├── services/        # Servicios auxiliares
└── utils/           # Utilidades
```

## 🔐 Autenticación

### Sistema Híbrido
- **Local**: email/password tradicional
- **Kick OAuth**: Integración con streaming platform

### Tokens
- **JWT**: Access tokens de corta duración
- **Refresh Tokens**: Tokens de larga duración con rotación

### Permisos
Sistema granular de roles y permisos:
- Roles: admin, moderador, usuario
- Permisos: granulares por funcionalidad

## 🎯 Sistema de Puntos

### Eventos que Otorgan Puntos
- **Chat**: Mensajes cada 5 minutos
- **Follow**: Primera vez que sigues
- **Suscripción**: Nueva suscripción o renovación
- **Regalos**: Subs regaladas

### Configuración
Los valores se configuran en `kick_points_config`:
```sql
SELECT * FROM kick_points_config;
```

## 🚨 Troubleshooting

### Error: "Table already exists"
```bash
# Registrar migraciones existentes
npm run sync:migrations register
```

### Error de Conexión a DB
```bash
# Verificar contenedores
docker ps

# Verificar configuración
cat .env

# Para desarrollo local
DB_HOST=localhost
DB_PORT=3307
```

### Verificar Estado de DB
```bash
# Ver tablas existentes
docker exec -it luisardito-mysql mysql -u app -papp luisardito_shop -e "SHOW TABLES;"

# Ver migraciones aplicadas
docker exec -it luisardito-mysql mysql -u app -papp luisardito_shop -e "SELECT * FROM SequelizeMeta ORDER BY name;"
```

## 📝 Mejores Prácticas

### Migraciones
1. **Siempre** incluir método `down()` para reversibilidad
2. **Nunca** modificar migraciones ya aplicadas en producción
3. **Crear nueva migración** para cualquier cambio de schema
4. **Probar** migraciones en desarrollo antes de producción

### Modelos
1. **Mantener sincronización** entre modelos y migraciones
2. **Documentar** relaciones complejas
3. **Usar comentarios** para campos no obvios

### Código
1. **Usar middlewares** para validaciones comunes
2. **Manejar errores** de forma consistente
3. **Documentar APIs** con comentarios claros

## 🔄 Workflow de Desarrollo

1. **Crear feature branch**
2. **Hacer cambios** en modelos/migraciones
3. **Probar localmente** con `npm run dev:reset`
4. **Verificar** que migraciones funcionan correctamente
5. **Commit y push**
6. **Deploy** ejecutando migraciones en producción

## 📚 Referencias

- [Sequelize Migrations](https://sequelize.org/docs/v6/other-topics/migrations/)
- [Docker Compose](https://docs.docker.com/compose/)
- [Kick.com API](https://kick.com/developer)

---

**Última actualización**: Diciembre 2024
**Estado**: ✅ Migraciones sincronizadas y funcionando correctamente

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

¿Necesitas ayuda? Revisa los logs o contacta al equipo.