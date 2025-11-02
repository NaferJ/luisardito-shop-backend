# Sistema de Logging Controlado por Variables de Entorno

## ✅ Implementación Completada

Se ha implementado un sistema de logging centralizado que permite controlar los logs de debug/info mediante variables de entorno, sin afectar el rendimiento en producción.

### 📊 Resumen de Cambios

- **Total de `console` reemplazados**: ~600+
- **Archivos modificados**: 40+
- **Nuevo archivo**: `src/utils/logger.js`

---

## 🚀 Cómo Funciona

### **¿Qué hace el `logger`?**

```javascript
// NO escribe archivos de log
// Solo muestra en Docker logs (stdout/stderr) si está habilitado

logger.info('Mensaje de debug')   // ← Se muestra SOLO si DEBUG_LOGS=true
logger.error('Error crítico')     // ← SIEMPRE se muestra (importante)
```

### **¿Dónde se ven los logs?**

```bash
# Ver logs en tiempo real
docker-compose -f docker-compose.prod.yml logs -f api

# O desde GitHub Actions después del deploy
```

---

## 🎯 TU FLUJO DE TRABAJO (GitHub Actions)

### **APAGAR logs** (recomendado para producción)

1. Editar `.github/workflows/prod-cd.yml` línea ~89:

```yaml
# Logging settings (false = logs apagados para máximo rendimiento)
echo "DEBUG_LOGS=false" >> "$ENV_PATH"
```

2. Hacer push:

```bash
git add .github/workflows/prod-cd.yml
git commit -m "Apagar logs en producción"
git push
```

3. **GitHub Actions automáticamente**:
   - ✅ Regenera `.env.backend.production` con `DEBUG_LOGS=false`
   - ✅ Reconstruye el contenedor
   - ✅ Reinicia el backend
   - ✅ Logs apagados (máximo rendimiento)

---

### **ENCENDER logs** (para monitorear algo específico)

1. Editar `.github/workflows/prod-cd.yml` línea ~89:

```yaml
# Logging settings (true = logs activados para monitoreo)
echo "DEBUG_LOGS=true" >> "$ENV_PATH"
```

2. Hacer push:

```bash
git add .github/workflows/prod-cd.yml
git commit -m "Activar logs temporalmente"
git push
```

3. **GitHub Actions automáticamente**:
   - ✅ Regenera `.env.backend.production` con `DEBUG_LOGS=true`
   - ✅ Reconstruye el contenedor
   - ✅ Reinicia el backend
   - ✅ Logs activados

---

## 📝 Tipos de Logs

### 1. **logger.info()** - Logs informativos (controlables)
```javascript
logger.info('🎯 [CHAT POINTS] Usuario recibió 5 puntos');
```
- ✅ Se muestran SI `DEBUG_LOGS=true`
- ❌ NO se muestran SI `DEBUG_LOGS=false`

### 2. **logger.warn()** - Advertencias (controlables)
```javascript
logger.warn('⚠️ Token expirando pronto');
```
- ✅ Se muestran SI `DEBUG_LOGS=true`
- ❌ NO se muestran SI `DEBUG_LOGS=false`

### 3. **logger.error()** - Errores (SIEMPRE visibles)
```javascript
logger.error('❌ Error crítico:', error.message);
```
- ✅ **SIEMPRE** se muestran (en todos los entornos)
- Críticos para diagnosticar problemas

### 4. **logger.debug()** - Debug extremo (controlables)
```javascript
logger.debug('Payload completo:', payload);
```
- ✅ Se muestran SI `DEBUG_LOGS=true`
- ❌ NO se muestran SI `DEBUG_LOGS=false`

---

## 🎯 Recomendaciones

### ✅ **Para el Lanzamiento de la Página**
```yaml
# En prod-cd.yml
echo "DEBUG_LOGS=false" >> "$ENV_PATH"
```
- **Ventaja**: Máximo rendimiento
- **Logs visibles**: Solo errores críticos (`logger.error`)
- **Uso**: Operación normal de producción

### ✅ **Para Diagnosticar Problemas Temporalmente**
```yaml
# En prod-cd.yml
echo "DEBUG_LOGS=true" >> "$ENV_PATH"
```
- **Ventaja**: Ver todo lo que está pasando
- **Logs visibles**: info, warn, error, debug (todo)
- **Uso**: Troubleshooting temporal
- **Importante**: ⚠️ Cambiar de vuelta a `false` después

---

## 📦 Estado Actual del Workflow

**Archivo**: `.github/workflows/prod-cd.yml`

**Configuración actual** (después de esta modificación):
```yaml
# Logging settings (false = logs apagados para máximo rendimiento)
echo "DEBUG_LOGS=false" >> "$ENV_PATH"
```

✅ **Los logs están APAGADOS por defecto** = Listo para lanzamiento

---

## 💡 Ejemplos Prácticos

### Ver logs después de un deploy
```bash
# Conectarte al servidor y ver logs en vivo
ssh user@servidor
cd ~/apps/luisardito-shop-backend
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f api
```

### Verificar configuración actual
```bash
# En el servidor
cat ~/.env.backend.production | grep DEBUG_LOGS
# Debería mostrar: DEBUG_LOGS=false (o true si los encendiste)
```

---

## ⚡ Impacto en Rendimiento

### Con `DEBUG_LOGS=false` (recomendado):
- ✅ **Cero impacto** en rendimiento
- ✅ Los `logger.info()` no ejecutan nada
- ✅ Solo los `logger.error()` se procesan (necesarios)
- ✅ Ideal para producción con alto tráfico

### Con `DEBUG_LOGS=true`:
- ⚠️ Impacto mínimo en I/O por escritura de logs
- ⚠️ Puede llenar Docker logs rápidamente con alto tráfico
- ✅ Útil para debugging temporal

---

## 🔍 Verificación

### ¿Cómo saber si los logs están activos?

**Opción 1 - Ver el workflow en GitHub**:
- Ir a `.github/workflows/prod-cd.yml`
- Buscar línea con `DEBUG_LOGS`
- Si dice `false` = logs apagados
- Si dice `true` = logs encendidos

**Opción 2 - Ver en el servidor**:
```bash
ssh user@servidor
cat ~/.env.backend.production | grep DEBUG_LOGS
```

**Opción 3 - Ver los logs en vivo**:
```bash
# Si hay muchos logs apareciendo = están encendidos
# Si solo ves errores = están apagados
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f api
```

---

## ✨ Resumen Ultra-Simple

| Acción | Cómo Hacerlo |
|--------|--------------|
| **Apagar logs** | Cambiar a `DEBUG_LOGS=false` en `prod-cd.yml` → push |
| **Encender logs** | Cambiar a `DEBUG_LOGS=true` en `prod-cd.yml` → push |
| **Estado actual** | `DEBUG_LOGS=false` (apagados - listo para lanzamiento) |
| **Ver logs** | `docker-compose logs -f api` en el servidor |

---

## ✅ Conclusión

- ✅ **Los logs NO escriben archivos**, solo se muestran en Docker logs (stdout/stderr)
- ✅ **Por defecto están APAGADOS** = máximo rendimiento
- ✅ **Para cambiarlos**: solo editas el workflow y haces push
- ✅ **GitHub Actions hace todo automáticamente**: regenera .env, reconstruye, reinicia
- ✅ **Sistema estable y listo para producción** 🚀

