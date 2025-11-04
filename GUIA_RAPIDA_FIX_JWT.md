# ⚡ GUÍA RÁPIDA - Fix JWT Expired Error

## 🚨 EL PROBLEMA EN 30 SEGUNDOS

```javascript
// permisos.middleware.js LÍNEA 6
const permisos = await Permiso.findAll({
    include: { model: RolPermiso, where: { rol_id: req.user.rol_id } }
    // ❌ Si req.user es null → CRASH
});
```

**Error:** `TypeError: Cannot read properties of null (reading 'rol_id')`

---

## 🔧 LA SOLUCIÓN EN 1 MINUTO

Editar: `src/middleware/permisos.middleware.js`

```javascript
const { Permiso, RolPermiso } = require('../models');

module.exports = function(verboPermiso) {
    return async (req, res, next) => {
        // ✅ AGREGAR ESTAS 5 LÍNEAS
        if (!req.user) {
            return res.status(401).json({ 
                error: 'Autenticación requerida' 
            });
        }
        
        // ... resto del código sin cambios
        const permisos = await Permiso.findAll({
            include: { model: RolPermiso, where: { rol_id: req.user.rol_id } }
        });
        const nombres = permisos.map(p => p.nombre);
        if (nombres.includes(verboPermiso)) return next();
        res.status(403).json({ error: 'Sin permiso' });
    };
};
```

---

## 📝 COMMIT Y DEPLOY

```bash
git add src/middleware/permisos.middleware.js
git commit -m "fix(permisos): validar req.user antes de acceder a rol_id"
git push origin main
```

---

## ✅ RESULTADO

**Antes:**
- ❌ Crash del servidor
- ❌ Error 500 con stack trace
- ❌ Usuario ve página en blanco

**Después:**
- ✅ Error 401 controlado
- ✅ Frontend refresca token automáticamente
- ✅ Usuario no nota nada

---

## 📊 DOCUMENTACIÓN COMPLETA

Para más detalles, ver:
- `RESUMEN_EJECUTIVO_JWT_ERROR.md` - Resumen completo del problema
- `ANALISIS_JWT_EXPIRED_ERROR.md` - Análisis técnico exhaustivo
- `PROPUESTA_IMPLEMENTACION_PROFESIONAL.md` - Soluciones profesionales
- `DIAGRAMAS_FLUJO_JWT_ERROR.md` - Diagramas visuales

---

## 🎯 POR QUÉ OCURRE

1. Access token expira en **1 hora** (no 1 mes)
2. Usuario hace request con token expirado
3. `auth.middleware` setea `req.user = null`
4. `permiso.middleware` intenta acceder `req.user.rol_id` sin validar
5. ❌ Crash

---

## 🔍 MONITOREAR POST-DEPLOY

```bash
# Ver que no haya más crashes (debe ser 0)
docker logs luisardito-shop-backend 2>&1 | \
  grep "Cannot read properties of null" | wc -l
```

---

**Estado:** ✅ LISTO PARA IMPLEMENTAR  
**Tiempo:** ⏱️ 5 minutos  
**Riesgo:** 🟢 Muy bajo  
**Impacto:** 🔴 Alto (elimina crashes)

