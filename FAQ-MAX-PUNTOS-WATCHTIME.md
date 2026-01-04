# ❓ Preguntas Frecuentes - Max Points y Watchtime

## 1. ¿Cuál es la diferencia entre `puntos` y `max_puntos`?

**`puntos`:** Saldo actual del usuario. Disminuye cuando hace canjes.

**`max_puntos`:** Máximo histórico que ha alcanzado. NUNCA disminuye, solo aumenta si supera el anterior.

```
Ejemplo:
- Usuario gana 1000 puntos → puntos: 1000, max_puntos: 1000
- Usuario hace canje y gasta 500 → puntos: 500, max_puntos: 1000
- Usuario gana 600 puntos → puntos: 1100, max_puntos: 1100
- Usuario hace canje y gasta 400 → puntos: 700, max_puntos: 1100
```

---

## 2. ¿Cómo se calcula el watchtime?

**+5 minutos por cada mensaje enviado en chat**, con un cooldown de 5 minutos entre actualizaciones.

```
Flujo:
├─ Usuario envía mensaje #1
│  └─ Cooldown: Redis bloquea por 5 minutos
│  └─ Watchtime: +5 minutos (total: 5)
│
├─ Usuario intenta enviar mensaje #2 en 3 minutos
│  └─ Cooldown: BLOQUEADO (falta 2 min)
│  └─ Watchtime: NO se actualiza
│
├─ Usuario envía mensaje #3 después de 5+ minutos
│  └─ Cooldown: PERMITIDO
│  └─ Watchtime: +5 minutos (total: 10)
```

---

## 3. ¿Se pierde el watchtime en algún momento?

**NO.** El watchtime es acumulativo y permanente. Solo se actualiza (nunca disminuye).

Si necesitas resetear el watchtime:
```sql
UPDATE user_watchtime SET total_watchtime_minutes = 0 WHERE usuario_id = 3;
```

---

## 4. ¿Qué pasa si el usuario no envía mensajes por días?

El registro de `user_watchtime` permanece intacto con el `last_message_at` actualizado a la última vez que envió un mensaje. El `first_message_date` NUNCA cambia.

```sql
-- Ver información de un usuario
SELECT * FROM user_watchtime WHERE usuario_id = 3;
-- Resultado:
-- usuario_id: 3
-- total_watchtime_minutes: 245
-- first_message_date: 2025-12-20 15:30:00 (NUNCA cambia)
-- last_message_at: 2026-01-04 10:15:00 (Se actualiza con cada mensaje)
```

---

## 5. ¿El watchtime se actualiza si el usuario tiene cooldown activo?

**NO.** El watchtime SOLO se actualiza si el usuario pasa el cooldown de 5 minutos en Redis.

Beneficio: Evita spam y asegura que solo usuarios activos acumulen watchtime.

---

## 6. ¿Cómo filtrar por max_puntos en el frontend?

El endpoint ya devuelve `max_puntos` en cada usuario. En frontend:

```javascript
// Ordenar por max_puntos descendente
leaderboard.sort((a, b) => b.max_puntos - a.max_puntos);

// Filtrar usuarios con max_puntos > 50000
const highAchievers = leaderboard.filter(u => u.max_puntos > 50000);

// Combinado: Mostrar usuario y diferencia con máximo
leaderboard.map(u => ({
  ...u,
  pointsDropped: u.max_puntos - u.puntos,
  recoveryPercentage: (u.puntos / u.max_puntos * 100).toFixed(2) + '%'
}));
```

---

## 7. ¿Qué pasa si el webhook falla?

**Si falla la transacción de puntos:**
- Se hace ROLLBACK de todo (puntos, max_puntos, watchtime)
- Se elimina el cooldown de Redis para permitir retry
- Se registra error en logs

**Esto asegura máxima consistencia:**
```
Si DB falla → No se actualiza nada → Próximo mensaje reintenta
```

---

## 8. ¿Cómo verificar que todo funciona correctamente?

### En la Base de Datos:
```sql
-- 1. Verificar estructura
DESC usuarios; -- Debe mostrar: max_puntos | int(11)
DESC user_watchtime; -- Debe existir la tabla

-- 2. Ver datos de un usuario
SELECT usuario_id, puntos, max_puntos FROM usuarios WHERE id = 3;
SELECT * FROM user_watchtime WHERE usuario_id = 3;

-- 3. Ver usuarios con máximo superado
SELECT usuario_id, puntos, max_puntos, (max_puntos - puntos) as dropped 
FROM usuarios 
WHERE max_puntos > puntos 
ORDER BY dropped DESC;
```

### En la API:
```bash
# Ver si max_puntos y watchtime_minutes están en respuesta
curl http://localhost:3000/api/leaderboard?limit=1 | jq '.data[0] | {usuario_id, puntos, max_puntos, watchtime_minutes}'
```

### En los Logs:
```bash
# Buscar actualizaciones de max_puntos
docker-compose logs luisardito-backend | grep "\[MAX POINTS\]"

# Buscar actualizaciones de watchtime
docker-compose logs luisardito-backend | grep "\[WATCHTIME\]"

# Ver todo junto
docker-compose logs -f luisardito-backend | grep -E "\[(MAX POINTS|WATCHTIME|REDIS COOLDOWN)\]"
```

---

## 9. ¿Puedo modificar el incremento de watchtime (+5 minutos)?

Sí, es un valor hardcodeado en `src/controllers/kickWebhook.controller.js`:

```javascript
// Cambiar de 5 a otro valor
await watchtime.increment(
  {
    total_watchtime_minutes: 5,  // ← Cambiar aquí (por ejemplo: 10)
    message_count: 1,
  },
  { transaction }
);
```

También en el script de inicialización (`initialize-watchtime.js`):
```javascript
total_watchtime_minutes: 5,  // ← Cambiar aquí si es necesario
```

---

## 10. ¿Cómo resetear datos de un usuario específico?

```sql
-- Resetear max_puntos (cuidado: los puntos no se resetean)
UPDATE usuarios SET max_puntos = puntos WHERE id = 3;

-- Resetear watchtime completamente
DELETE FROM user_watchtime WHERE usuario_id = 3;

-- O solo resetear minutos (mantener registro)
UPDATE user_watchtime 
SET total_watchtime_minutes = 0, message_count = 0 
WHERE usuario_id = 3;
```

---

## 11. ¿Afecta esto al canje de puntos?

**No directamente.** El canje sigue funcionando igual:
- Disminuye `puntos`
- NO afecta `max_puntos` (que es histórico)
- NO afecta `watchtime_minutes` (que es independiente)

Pero en el frontend podrías mostrar:
```json
{
  "usuario_id": 3,
  "puntos": 500,
  "max_puntos": 10000,
  "watchtime_minutes": 120,
  "canjesPendientes": 3,
  "accountStatus": "very_active_but_low_balance"
}
```

---

## 12. ¿Qué pasa con usuarios creados antes de esta actualización?

**Max Points:**
- Se establece en 0 automáticamente
- Se actualiza al recibir el primer punto
- Los `initialize-watchtime.js` hace backfill: `max_puntos = puntos` para existentes

**Watchtime:**
- Se crea nuevo registro cuando el usuario envíe su primer mensaje post-actualización
- Usuarios existentes comienzan en 0 minutos
- Si quieres backfill, puedes hacerlo manualmente:
  ```sql
  INSERT INTO user_watchtime (usuario_id, kick_user_id, total_watchtime_minutes, message_count)
  SELECT id, user_id_ext, 0, 0 FROM usuarios WHERE NOT EXISTS (
    SELECT 1 FROM user_watchtime WHERE usuario_id = usuarios.id
  );
  ```

---

## 13. ¿Cómo monitorear el sistema en producción?

```bash
# Tail de logs con filtros
docker-compose logs -f luisardito-backend | \
  grep -E "(CHAT MESSAGE|MAX POINTS|WATCHTIME|REDIS COOLDOWN|ERROR)"

# Ver últimos 100 logs
docker-compose logs --tail 100 luisardito-backend

# Estadísticas de base de datos
docker-compose exec db mysql -u app -papp -e "
  SELECT 
    COUNT(*) as total_usuarios,
    COUNT(CASE WHEN puntos > 0 THEN 1 END) as usuarios_con_puntos,
    COUNT(CASE WHEN max_puntos > puntos THEN 1 END) as usuarios_con_drop,
    AVG(max_puntos) as promedio_max_puntos
  FROM usuarios;
"
```

---

## 14. ¿Hay límite de watchtime?

**No hay límite técnico.** El watchtime puede crecer indefinidamente:
- 5 minutos por mensaje
- Si alguien envía 1 mensaje cada 5 minutos durante 100 horas = 1200 minutos de watchtime

Podrías implementar límites en el frontend si lo necesitas.

---

## 15. ¿Se sincroniza el watchtime entre plataformas (Kick/Discord)?

**Actualmente: NO.**

El watchtime se calcula solo desde webhooks de Kick (`chat.message.sent`).

Para incluir Discord, habría que:
1. Recibir eventos de Discord (mensaje en servidor)
2. Actualizar el mismo registro de `user_watchtime`
3. Lógica de sincronización entre plataformas

---

## Troubleshooting

### Error: "Column 'max_puntos' doesn't exist"
✅ Solución: Aplicar migración → `npm run migrate`

### Error: "Table 'user_watchtime' doesn't exist"
✅ Solución: Aplicar migración → `npm run migrate`

### Max_puntos no se actualiza
- Verificar que el webhook reciba eventos (`chat.message.sent`)
- Buscar logs: `grep [MAX POINTS]`
- Enviar un mensaje de prueba en Kick
- Verificar BD: `SELECT * FROM usuarios WHERE id = 3;`

### Watchtime no se actualiza
- Verificar que Redis esté funcionando
- Buscar logs: `grep [REDIS COOLDOWN]`
- Esperar 5 minutos entre mensajes de prueba
- Verificar BD: `SELECT * FROM user_watchtime WHERE usuario_id = 3;`

### Los datos se ven correctos pero API no devuelve campos nuevos
- Reiniciar servidor: `docker-compose restart luisardito-backend`
- Limpiar cache: `docker-compose down && docker-compose up`
- Verificar logs de startup por errores

---

## Recursos Útiles

- 📖 **Guía Completa:** `LEADERBOARD-MAX-PUNTOS-WATCHTIME.md`
- 📊 **Resumen Técnico:** `IMPLEMENTACION-RESUMEN.md`
- ✅ **Verificación:** `node verify-implementation.js`
- 🚀 **Despliegue:** `bash deploy-watchtime.sh`
- 🔧 **Inicialización:** `node initialize-watchtime.js`

---

**Última actualización:** 2026-01-04
**Versión:** 1.0
**¿Pregunta no respondida?** Revisa los logs o contacta al equipo de desarrollo.

