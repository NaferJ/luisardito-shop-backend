# 🚨 COMANDOS URGENTES PARA PRODUCTIVO

## ⚠️ **PROBLEMA IDENTIFICADO:**
- Usuario 33112734 (NaferJ): **2459 registros duplicados**
- Usuario 64617769: **13 registros duplicados**

## 🔧 **EJECUTA ESTOS COMANDOS UNO POR UNO:**

### **1. Hacer backup de seguridad:**
```bash
cd ~/apps/luisardito-shop-backend
docker exec luisardito-mysql mysqldump -u root -proot luisardito_shop kick_chat_cooldowns > backup_cooldowns_$(date +%Y%m%d_%H%M%S).sql
```

### **2. Ver estadísticas actuales:**
```bash
docker exec luisardito-mysql mysql -u root -proot luisardito_shop -e "SELECT COUNT(*) as total, COUNT(DISTINCT kick_user_id) as unicos FROM kick_chat_cooldowns;"
```

### **3. Limpiar duplicados (MANTENER SOLO EL MÁS RECIENTE):**
```bash
docker exec luisardito-mysql mysql -u root -proot luisardito_shop -e "
DELETE t1 FROM kick_chat_cooldowns t1
INNER JOIN kick_chat_cooldowns t2
WHERE t1.kick_user_id = t2.kick_user_id
AND (
    t1.updated_at < t2.updated_at OR
    (t1.updated_at = t2.updated_at AND t1.created_at < t2.created_at) OR
    (t1.updated_at = t2.updated_at AND t1.created_at = t2.created_at AND t1.id < t2.id)
);
"
```

### **4. Verificar que no quedan duplicados:**
```bash
docker exec luisardito-mysql mysql -u root -proot luisardito_shop -e "SELECT kick_user_id, COUNT(*) as count FROM kick_chat_cooldowns GROUP BY kick_user_id HAVING COUNT(*) > 1;"
```

### **5. Crear índice UNIQUE:**
```bash
docker exec luisardito-mysql mysql -u root -proot luisardito_shop -e "ALTER TABLE kick_chat_cooldowns ADD UNIQUE INDEX idx_kick_user_id_unique (kick_user_id);"
```

### **6. Verificar que el índice se creó:**
```bash
docker exec luisardito-mysql mysql -u root -proot luisardito_shop -e "SHOW INDEX FROM kick_chat_cooldowns WHERE Column_name = 'kick_user_id' AND Non_unique = 0;"
```

### **7. Subir archivos actualizados:**
```bash
# Desde tu máquina local, subir el webhook controller actualizado
scp src/controllers/kickWebhook.controller.js naferj@vps-4556ad01:~/apps/luisardito-shop-backend/src/controllers/

# Subir el test (opcional)
scp test-cooldown-quick.js naferj@vps-4556ad01:~/apps/luisardito-shop-backend/
```

### **8. Reiniciar backend en productivo:**
```bash
cd ~/apps/luisardito-shop-backend
docker-compose restart luisardito-backend
docker logs luisardito-backend --tail 10
```

### **9. Probar que funciona:**
```bash
docker exec luisardito-backend node test-cooldown-quick.js
```

## 📊 **RESULTADO ESPERADO:**

**Antes:** 2472 registros (2459 + 13 duplicados)  
**Después:** 2 registros (1 por usuario único)

## ⚠️ **NOTAS IMPORTANTES:**

- ✅ Se hace **backup** antes de limpiar
- ✅ Se mantiene el registro **más reciente** de cada usuario
- ✅ **NO se pierden datos importantes** (solo duplicados de cooldown)
- ✅ El cooldown funcionará **perfectamente** después

## 🆘 **SI ALGO SALE MAL:**

```bash
# Restaurar desde backup
mysql -u root -proot luisardito_shop < backup_cooldowns_YYYYMMDD_HHMMSS.sql
```

**¡Ejecuta los comandos paso a paso y el cooldown funcionará en productivo!**
