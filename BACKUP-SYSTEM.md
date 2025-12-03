# 🔄 Sistema de Backups Automáticos

Sistema completo de backups para la base de datos MySQL con almacenamiento dual: local + GitHub.

## 📋 Características

✅ **Backups automáticos diarios** a las 3:00 AM
✅ **Compresión automática** con gzip (reduce 80-90% el tamaño)
✅ **Almacenamiento dual**: Local (restauración rápida) + GitHub (seguridad)
✅ **Rotación inteligente**: Mantiene últimos 3 días localmente, 30+ días en GitHub
✅ **Versionado completo** en GitHub con historial
✅ **Scripts de emergencia** para backup/restore manual

## 🏗️ Arquitectura

```
Cron Job (3:00 AM diario)
    ↓
mysqldump → gzip → 
    ├─ Local: /backups/local/backup-YYYY-MM-DD.sql.gz
    └─ GitHub: /YYYY/MM/backup-YYYY-MM-DD.sql.gz (auto-commit)
```

## 🚀 Configuración

### Variables de entorno (.env)

```bash
# Habilitar backups
BACKUP_ENABLED=true

# GitHub (configurado en GitHub Secrets)
BACKUP_GITHUB_REPO_URL=https://github.com/NaferJ/luisardito-shop-backups.git
BACKUP_GITHUB_TOKEN=ghp_tu_token_aqui
BACKUP_GITHUB_USER_EMAIL=tu-email@github.com

# Configuración
BACKUP_TIME=03:00              # Hora del backup diario (formato 24h)
BACKUP_RETENTION_DAYS=3        # Días de retención local
```

### GitHub Secrets (Ya configurados)

En tu repo `luisardito-shop-backend` → Settings → Secrets:

- `BACKUP_GITHUB_TOKEN` → Token con permisos de `repo`
- `BACKUP_GITHUB_REPO_URL` → URL del repo de backups
- `BACKUP_GITHUB_USER_EMAIL` → Tu email de GitHub

## 📦 Scripts Disponibles

### 1. Backup Manual

Ejecuta un backup inmediatamente (útil antes de despliegues):

```bash
node manual-backup.js
```

### 2. Listar Backups

Ver todos los backups disponibles localmente:

```bash
node list-backups.js
```

### 3. Restaurar Backup

**Restaurar el más reciente:**
```bash
node restore-backup.js
```

**Restaurar uno específico:**
```bash
node restore-backup.js backup-2025-12-02-15-30-00.sql.gz
```

⚠️ **ADVERTENCIA**: Esto sobrescribe la base de datos actual. Confirma antes de proceder.

## 🔄 Flujo Automático

### Backup Diario (3:00 AM)

1. **Dump MySQL** → Crea backup completo con triggers, routines, events
2. **Compresión** → gzip reduce tamaño 80-90%
3. **Guardado Local** → `/backups/local/` para restauración rápida
4. **Push a GitHub** → Commit automático con fecha
5. **Limpieza** → Elimina backups locales > 3 días

### Estructura en GitHub

```
luisardito-shop-backups/
├── 2025/
│   ├── 12/
│   │   ├── backup-2025-12-01-03-00-00.sql.gz
│   │   ├── backup-2025-12-02-03-00-00.sql.gz
│   │   └── backup-2025-12-03-03-00-00.sql.gz
│   └── 11/
│       └── ...
└── 2024/
    └── ...
```

## 🆘 Recuperación de Emergencia

### Escenario 1: Base de datos corrupta (últimos 3 días)

```bash
# 1. Listar backups disponibles
node list-backups.js

# 2. Restaurar el más reciente
node restore-backup.js

# 3. Reiniciar aplicación
docker compose restart api
```

⏱️ **Tiempo de recuperación**: ~1 minuto

### Escenario 2: Necesitas un backup antiguo (> 3 días)

```bash
# 1. Clonar repo de backups
cd ~
git clone https://github.com/NaferJ/luisardito-shop-backups.git

# 2. Buscar el backup que necesitas
cd luisardito-shop-backups
ls -lh 2025/11/

# 3. Copiar a directorio de backups locales
cp 2025/11/backup-2025-11-15-03-00-00.sql.gz \
   ~/apps/luisardito-shop-backend/backups/local/

# 4. Restaurar
cd ~/apps/luisardito-shop-backend
node restore-backup.js backup-2025-11-15-03-00-00.sql.gz

# 5. Reiniciar
docker compose restart api
```

⏱️ **Tiempo de recuperación**: ~5 minutos

### Escenario 3: Servidor completo perdido

```bash
# 1. Nuevo servidor: clonar app
git clone https://github.com/NaferJ/luisardito-shop-backend.git
cd luisardito-shop-backend

# 2. Clonar backups
git clone https://github.com/NaferJ/luisardito-shop-backups.git backups/github

# 3. Copiar backup más reciente
cp backups/github/2025/12/backup-2025-12-02-03-00-00.sql.gz backups/local/

# 4. Configurar .env y levantar servicios
docker compose up -d

# 5. Restaurar backup
node restore-backup.js

# 6. Reiniciar
docker compose restart api
```

⏱️ **Tiempo de recuperación**: ~15-20 minutos

## 📊 Monitoreo

### Ver logs de backups

```bash
# En producción
docker compose logs -f api | grep -i backup

# Logs específicos del último backup
docker compose logs api --tail=100 | grep "🔄\|✅\|❌"
```

### Estado del servicio

El backup está integrado en el ciclo de vida de la aplicación. Al iniciar, verás:

```
⏰ Programando backup diario a las 03:00
✅ Scheduler de backups iniciado (0 3 * * *)
```

## 🔧 Troubleshooting

### ❌ "GitHub token no configurado"

**Causa**: Falta `BACKUP_GITHUB_TOKEN` en variables de entorno

**Solución**: Verifica que el secret esté configurado en GitHub Actions y que se haya desplegado

### ❌ "Error al crear dump de MySQL"

**Causa**: Contenedor MySQL no disponible o credenciales incorrectas

**Solución**:
```bash
# Verificar que MySQL está corriendo y accesible
docker ps | grep luisardito-mysql

# Probar conexión desde el contenedor backend
docker exec luisardito-backend mysql -h db -u root -proot -e "SELECT 1"

# Ver logs de MySQL
docker logs luisardito-mysql
```

### ❌ "Error al subir a GitHub"

**Causa**: Token sin permisos o repo no accesible

**Solución**:
1. Verifica que el token tenga permiso `repo`
2. Confirma que el repo existe y es privado
3. Prueba el token manualmente:
```bash
curl -H "Authorization: token ghp_tu_token" \
     https://api.github.com/user
```

### ⚠️ "Backup local pero no en GitHub"

**Causa**: Problema de conectividad o permisos

**Impacto**: El backup existe localmente, puedes subirlo manualmente:

```bash
cd ~/apps/luisardito-shop-backend/backups/github

# Configurar git si es necesario
git config user.email "tu-email@github.com"
git config user.name "Manual Backup"

# Subir manualmente
git add .
git commit -m "Backup manual - $(date)"
git push origin main
```

## 📈 Mejores Prácticas

### ✅ DO

- ✅ Ejecuta un backup manual antes de migraciones importantes
- ✅ Prueba la restauración periódicamente (cada mes)
- ✅ Verifica los logs después de cada backup automático
- ✅ Mantén el token de GitHub seguro y rotado anualmente
- ✅ Descarga backup mensual a tu PC (backup del backup)

### ❌ DON'T

- ❌ No deshabilites backups sin razón (`BACKUP_ENABLED=false`)
- ❌ No compartas el token de GitHub
- ❌ No hagas git push directo al repo de backups (deja que sea automático)
- ❌ No restaures backups sin confirmar la fecha correcta
- ❌ No elimines backups manualmente del servidor sin verificar GitHub

## 🎯 Estrategia 3-2-1

Tu configuración cumple con la regla 3-2-1:

✅ **3 copias**: Local + GitHub + (opcional: Google Drive mensual)
✅ **2 medios**: Disco local + Nube (GitHub)
✅ **1 off-site**: GitHub (fuera del servidor)

## 📅 Mantenimiento

### Mensual (Opcional pero recomendado)

1. **Día 1 del mes**: Descarga backup a Google Drive
```bash
# En tu servidor
cd ~/apps/luisardito-shop-backend/backups/local
# Descarga el backup más reciente a tu PC
# Súbelo manualmente a Google Drive/2025/
```

2. **Verificar integridad**:
```bash
node list-backups.js
# Confirma que hay backups recientes
```

3. **Test de restauración** (en staging/local):
```bash
# Copia un backup a tu entorno local
# Prueba restaurarlo
node restore-backup.js backup-test.sql.gz
```

## 🔐 Seguridad

- ✅ Backups almacenados en **repo privado** de GitHub
- ✅ Token con permisos mínimos necesarios (`repo`)
- ✅ Compresión reduce exposición de datos
- ✅ Sin contraseñas hardcodeadas (todo en .env)
- 💡 **Opcional**: Cifra backups con GPG antes de subir a GitHub

## 📞 Soporte

Si tienes problemas:

1. Revisa logs: `docker compose logs api | grep backup`
2. Verifica que MySQL esté corriendo: `docker ps`
3. Confirma secrets en GitHub: Settings → Secrets
4. Prueba backup manual: `node manual-backup.js`

## 📝 Changelog

- **2025-12-02**: Sistema inicial implementado
  - Backups diarios a las 3:00 AM
  - Almacenamiento dual (local + GitHub)
  - Scripts de emergencia
  - Rotación automática
