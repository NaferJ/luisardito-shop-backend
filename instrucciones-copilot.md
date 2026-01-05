# Instrucciones Personalizadas para GitHub Copilot

**Última Actualización**: Enero 2026  
**Repositorio**: shop.luisardito.com  
**Versión**: 1.0  
**Frecuencia de Mantenimiento**: Actualizar en cambios mayores de dependencias, cambios arquitectónicos o actualizaciones de flujo de trabajo (revisión mensual recomendada)

---

## Descripción General del Proyecto

**Propósito**: Backend API para la plataforma de overlays en tiempo real y gestión de tienda para el ecosistema Luisardito, integrando OAuth de Discord, APIs de streaming en vivo (Kick), autenticación JWT y base de datos MySQL con Redis para caché.

**Tipo**: Aplicación Backend (API REST con WebSockets)  
**Stack Tecnológico**: 
- **Backend**: Node.js (Express v5.1.0), 
- **Bases de Datos**: MySQL/MariaDB, Redis (caché)
- **Infraestructura**: Docker, Docker Compose, VPS Linux
- **DevOps**: GitHub Actions
- **Librerías Clave**: axios, discord.js, ws, sequelize, jsonwebtoken, bcryptjs, ioredis

**Escala del Código**: 14 repositorios (etiquetados por dominio: LY, MR, TS, CR, etc.) con patrones de arquitectura compartidos; <5000 archivos indexables por repositorio

**Entorno Actual**: VSCode con extensión GitHub Copilot + integración navegador; Perplexity Pro para investigación profunda

---

## Estructura de Directorios y Rutas Clave

```
luisardito-shop-backend/
├── app.js
├── config.js
├── docker-compose.override.yml
├── docker-compose.prod.yml
├── docker-compose.yml
├── Dockerfile
├── instrucciones-copilot.md
├── LICENSE
├── package.json
├── sequelize.config.js
├── assets/
│   └── README.md
│   └── images/
├── backups/
│   ├── github/
│   └── local/
├── migrations/
│   └── [archivos de migración Sequelize]
├── scripts/
│   └── [scripts de automatización]
├── seeders/
│   └── [seeders de base de datos]
├── src/
│   └── [código fuente principal]
└── tokens/
```

---

## Comandos de Build, Test y Validación

### Prerrequisitos
```bash
# Verifica versiones requeridas (exactas para evitar incompatibilidades)
node --version          # Esperado: v18.17.0 o v20.11.0+
npm --version           # Esperado: v9.0.0+
docker --version        # Esperado: Docker 24.0+
docker-compose --version # Esperado: v2.20+
```

### 1. Bootstrap y Dependencias

**SIEMPRE ejecuta estos comandos PRIMERO antes de cualquier otro paso:**

```bash
# Instalación limpia (recomendado para CI/CD o checkout nuevo)
npm ci

# O instalación estándar (desarrollo local)
npm install

# Instala integraciones opcionales de streaming (bots de Kick, Discord)
npm install discord.js axios socket.io

# Nota: package-lock.json debe estar comprometido; no elimines node_modules manualmente
# Si hay problemas de dependencias: rm -rf node_modules && npm ci
```

### 2. Entorno de Desarrollo

```bash
# Inicia servidor local con recarga en caliente
npm run dev
# Salida esperada: "Escuchando en http://localhost:3000"
# Toma ~15 segundos en iniciarse

# Si usas Docker Compose para stack completo (MySQL + Redis + App)
docker-compose -f docker-compose.yml up
# Servicios: app (puerto 3000), mysql (3306), redis (6379)
# Nota: Primera ejecución puede tomar 2-3 minutos para inicializar MySQL
```

### 3. Proceso de Build

```bash
# Build de imagen Docker
docker build -t luisardito-shop-backend:latest .

# Etiqueta para registro (si usas GitHub Container Registry)
docker tag luisardito-shop-backend:latest ghcr.io/tu-usuario/luisardito-shop-backend:latest
docker push ghcr.io/tu-usuario/luisardito-shop-backend:latest
```

### 4. Testing

```bash
# Ejecuta todas las pruebas (Jest)
npm test
# Actualmente sin pruebas. Implementación pendiente.

# Cuando se implemente, usar:
npm test -- --coverage
npm test -- --watch
```

### 5. Linting y Calidad de Código

```bash
# No hay linting configurado actualmente
# Recomendado: Agregar ESLint y Prettier en el futuro

# Verificación de tipos (no aplica, proyecto en JavaScript)
# Proyecto usa JavaScript, no TypeScript
```

### 6. Validación Completa Pre-commit (Pipeline Completo)

```bash
# Esto es lo que GitHub Actions ejecuta—replícalo localmente antes de push:
npm ci                          # Instalación limpia
npm test                        # Pruebas (actualmente no implementadas)
docker build -t luisardito-shop-backend:test .  # Build de Docker

# Tiempo total esperado: 2-3 minutos
# Todos los pasos deben pasar para merge exitoso
```

### 7. Validación de Docker

```bash
# Build y test de imagen Docker localmente
docker build -t luisardito-shop-backend:test .

# Ejecuta contenedor con variables de entorno
docker run -p 3000:3000 \
  -e DB_HOST="localhost" \
  -e DB_USER="root" \
  -e DB_PASSWORD="password" \
  -e DB_NAME="luisardito_shop" \
  luisardito-shop-backend:test

# Verifica que el servicio esté saludable
curl http://localhost:3000/api/health
# Respuesta esperada: {"status":"ok"}
```

---

## Arquitectura y Patrones Clave

### Arquitectura del Backend (API)
- **Patrón MVC**: Controllers → Models → Routes
- **ORM**: Sequelize para abstracción de BD MySQL
- **Autenticación**: JWT + OAuth Kick integration
- **WebHooks**: Receptores de eventos Kick
- **Caché**: Redis para sesiones y datos en tiempo real

### Estrategia Multi-Repositorio
- **14 repositorios etiquetados por dominio** (LY, MR, TS, CR, COO, SB, CTURB, CL, TRPLUS, CTT, CP, CTNO, FR, CIN, CUS, TM, TSD, CCO)
- **Patrones Compartidos**: Mismo stack, estructura de directorios similar, integraciones de API específicas del dominio
- **Despliegue**: Cada repositorio se despliega de forma independiente a instancias VPS etiquetadas
- **Base de Datos**: Servidor MySQL centralizado compartido entre repositorios (bases de datos separadas por dominio)

### Integraciones de Streaming
- **API de Kick**: Escuchadores personalizados de webhook para meta-subs, seguimientos, raids
- **API de Twitch**: OAuth + suscripciones EventSub (plataforma alternativa/secundaria)
- **Integración Discord**: Bot para comandos, gestión de roles, notificaciones
- **Protocolo de Overlay**: Formato de payload JSON personalizado para sincronización de estado de overlay React

---

## Variables de Entorno y Configuración

### Variables de Entorno Requeridas (Siempre establecer antes de desplegar)

```bash
# .env (o .env.production)

# Server
PORT=3000

# Database (DigitalOcean Managed DB compatible)
DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=luisardito_shop
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false

# Auth
JWT_SECRET=

# Kick OAuth (if applicable)
KICK_CLIENT_ID=
KICK_CLIENT_SECRET=
KICK_REDIRECT_URI=http://localhost:3000/api/auth/kick-callback

# Kick Broadcaster (ID del streamer principal - Luisardito)
KICK_BROADCASTER_ID=

# Optional DB connection wait settings
# DB_CONNECT_RETRIES=30
# DB_CONNECT_RETRY_DELAY_MS=2000
```

### Desarrollo Local (.env.local o .env.development)

```bash
# Simplificado para testing local
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=luisardito_shop
JWT_SECRET=secret_dev
```

**Prioridad de Configuración**: Variables de entorno > defaults en config.js

---

## Pipeline de CI/CD y GitHub Actions

### Verificaciones Automatizadas (GitHub Actions)

**Ubicación**: `.github/workflows/ci.yml` y `prod-cd.yml`

**Se activa en**: `git push` a `main` o pull requests

**Etapas del pipeline**:
1. **Instalación de Dependencias** (npm ci)
2. **Pruebas** (npm test)
3. **Build de Docker** → Construye imagen Docker
4. **Push de Imagen** (si merge a main) → Push al registro de contenedores

### Despliegue Manual

```bash
# Despliega a VPS de producción
git push origin main

# O despliegue manual por CLI (si está disponible)
npm run desplegar:produccion

# Rollback (si es necesario)
npm run rollback:produccion

# Verifica despliegue
curl https://shop.luisardito.com/api/salud
```

### Monitoreo y Rollback

- **Rastreo de Errores**: Sentry para excepciones en producción
- **Logs**: CloudWatch o Datadog (configurar en `docker-compose.yml`)
- **Health Checks**: Endpoint `/api/salud` (verifica conectividad BD + Redis)

---

## Patrones de Codificación Comunes y Convenciones

### Patrón de Ruta de API (Express)

```javascript
// src/routes/auth.js
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { AuthController } = require('../controllers/AuthController');

const router = express.Router();

router.post('/login', AuthController.login);
router.post('/register', AuthController.register);
router.get('/me', authenticate, AuthController.getProfile);

module.exports = router;
```

### Patrón de Modelo Sequelize

```javascript
// src/models/User.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'users',
  timestamps: true,
});

module.exports = User;
```

### Conventional Commits

Todos los commits DEBEN seguir este formato (enforazado por generación de commits con Copilot):

```
<tipo>(<alcance>): <asunto> (en español o inglés)

<cuerpo> (opcional, explica por qué no qué)
```

**Tipos Válidos**: `feat` | `fix` | `docs` | `style` | `refactor` | `perf` | `test` | `chore` | `ci`

**Ejemplos**:
- `feat(auth): agregar endpoint de login con OAuth Kick`
- `fix(db): corregir conexión MySQL en migraciones`
- `docs(api): actualizar documentación de endpoints`
- `chore(deps): actualizar discord.js a v14.25.1`

---

## Gestión de Dependencias y Seguridad

### Dependencias Críticas (No Actualizar Sin Testing)

| Dependencia | Versión | Razón | Cadencia de Actualización |
|---|---|---|---|
| Node.js | 18 LTS o 20 LTS | Soporte a largo plazo | Anualmente |
| Express | 5.1.0 | Framework principal | Semestralmente |
| Sequelize | 6.37.7 | ORM para BD | Semestralmente |
| MySQL2 | 3.14.3 | Driver MySQL | Semestralmente |
| Discord.js | 14.25.1 | Integración Discord | Trimestral |
| Axios | 1.11.0 | Cliente HTTP | Semestralmente |

### Checklist de Actualización

```bash
# Verifica paquetes obsoletos
npm outdated

# Audita vulnerabilidades de seguridad
npm audit

# Arregla vulnerabilidades de bajo riesgo
npm audit fix

# Para actualizaciones manuales
npm update <paquete>@latest
npm test  # Siempre prueba después de actualizar dependencias
```

### Excluidos de Actualizaciones Automáticas

- **Versión de Node**: Nunca saltes versiones menores (18.17.0 → 18.18.x OK, pero no 18 → 20 automático)
- **Imagen base de Docker**: Usa versiones fijas (`node:18.17.0-alpine` no `node:latest`)

---

## Rendimiento y Pautas de Optimización

### Optimización del Frontend

- **Tamaño de bundle**: Mantener <500KB comprimido (rastreado en CI)
- **Carga perezosa**: Code-split de componentes de overlay para fast first-paint
- **Caché**: Service workers para persistencia offline de overlays
- **Imágenes**: Comprime y sirve vía CDN (rclone + S3)

### Optimización del Backend

- **Índices de BD**: Indexar en `id_usuario`, `id_stream`, `fecha_creacion` para consultas comunes
- **Optimización de Consultas**: Usa `.select()` y `.limit()` para reducir memoria de MySQL
- **Caché de Redis**: Cachea datos de usuarios Discord, estado de streaming (TTL: 5 min)
- **Pool de Conexiones**: Conexiones MySQL en pool en producción (máximo 20 conexiones)

### Monitoreo

```bash
# Monitorea contenedor en ejecución
docker stats luisardito-shop-backend  # Uso de CPU, memoria, red

# Verifica logs de la aplicación
docker-compose logs -f api
```

---

## Troubleshooting y Problemas Comunes

### Problema: `npm test` Falla Sin `npm ci`

**Causa Raíz**: node_modules obsoleto o lockfile no coincide  
**Solución**:
```bash
rm -rf node_modules package-lock.json
npm ci  # Instalación limpia desde package-lock.json
npm test
```

### Problema: Sequelize Migrations Fallan en Producción

**Causa Raíz**: Conexión SSL a MySQL no configurada correctamente  
**Solución**:
```bash
# Verifica variables de entorno
echo $DB_SSL  # Debe ser true
echo $DB_SSL_REJECT_UNAUTHORIZED  # Debe ser false para DigitalOcean

# Ejecuta migrations manualmente
npm run migrate
```

### Problema: `npm run build` Excede Límite de Memoria en CI

**Causa Raíz**: Bundler sin memoria de heap disponible  
**Solución**:
```bash
# Aumenta límite de memoria de Node
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### Problema: Discord OAuth Retorna 401 No Autorizado

**Causa**: Token expirado o `DISCORD_CLIENT_SECRET` no coincide  
**Solución**:
```bash
# Verifica credenciales en Discord Developer Portal
# Asegúrate de que REDIRECT_URI coincide: https://shop.luisardito.com/api/auth/discord/callback
# Refresca secrets y redeploy
```

---

## Cadencia de Actualización y Cronograma de Mantenimiento

| Tarea | Frecuencia | Responsable | Notas |
|---|---|---|---|
| Actualizar `copilot-instrucciones.md` | Mensual o después de cambios mayores | Responsable | Revisa log de Conventional Commits para cambios arquitectónicos |
| Revisar dependencias | Semanal (npm outdated) | DevOps | Actualiza si hay patches de seguridad |
| Ejecutar pipeline de validación completa | Antes de cada merge | CI/CD | GitHub Actions lo enforza |
| Reconstruir imágenes Docker | Después de actualizaciones de dependencias | DevOps | Etiqueta con fecha (ej: `2026-01-05`) |
| Archivar logs y datos antiguos | Trimestral | Ops | Elimina logs >3 meses para ahorrar almacenamiento |
| Auditoría de seguridad | Mensual | Seguridad | `npm audit`, escaneos SCA, penetration testing |

### Cuándo Actualizar Este Documento

- **Siempre actualiza si**:
  - Nueva versión major de dependencia adoptada
  - Estructura de directorios cambia significativamente
  - Comandos de build/test se modifican
  - Se requieren nuevas variables de entorno
  - Proceso de despliegue cambia
  - Patrones de arquitectura cambian

- **Actualiza header**: Cambia fecha de "Última Actualización" después de editar
- **Número de versión**: Incrementa en cambios estructurales/contenido mayor

---

## Pro Tips para Agentes de Copilot

1. **Usa @workspace en VSCode**: Referencia explícitamente `@workspace` en Copilot Chat para asegurar que cargue el contexto del codebase
   ```
   @workspace: "Agregar nuevo endpoint de API para gestión de productos con autenticación JWT"
   ```

2. **Fija este archivo en Chat**: Adjunta `.github/copilot-instrucciones.md` como contexto antes de tareas complejas
   ```
   "Referenciando: .github/copilot-instrucciones.md"
   ```

3. **Para trabajo multi-repo**: Incluye etiqueta de dominio en solicitudes
   ```
   "[Dominio LY] Arreglar flujo de autenticación en middleware OAuth de Discord"
   ```

4. **Valida sugerencias localmente**: 
   - Desarrollo: `npm run dev` y verifica logs
   - Docker: `docker-compose up` y prueba endpoints
   - Siempre ejecuta antes de commit

5. **Valida cambios de Docker**: Usa `docker-compose up && curl http://localhost:3000/health` para verificar cambios de configuración de contenedor

---

## Soporte y Referencias

- **Documentación GitHub Copilot**: https://docs.github.com/copilot
- **Contexto de Workspace VSCode**: https://code.visualstudio.com/docs/copilot/reference/workspace-context
- **Guía Discord.js**: https://discordjs.guide/
- **Docs API Kick**: [Wiki Interno]
- **Slack del Equipo**: #soporte-tecnico
- **Contactos Críticos**: lider-tecnico@luisardito.com

---

**Fin de Instrucciones para Copilot. Última revisión: Enero 2026 v1.0**