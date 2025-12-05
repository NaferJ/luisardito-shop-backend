# 🎯 Actualización del Sistema de Puntos - API Mejorada

## ✅ Cambios en el Backend

El endpoint `PUT /api/usuarios/:id/puntos` ahora soporta dos modos de operación:

### Antes (❌ Problema)
```javascript
// El backend siempre establecía los puntos directamente
{
  "puntos": 50000,  // Siempre establecía a 50000
  "motivo": "Ajuste manual"
}
```

### Ahora (✅ Solución)
```javascript
{
  "puntos": 1000,
  "operation": "add",  // "add" o "set"
  "motivo": "Bonus por evento"
}
```

## 📋 Modos de Operación

### 1. `operation: "add"` - Sumar/Restar Puntos
```javascript
// Ejemplo: Sumar 1000 puntos
{
  "puntos": 1000,
  "operation": "add",
  "motivo": "Bonus por evento"
}

// Ejemplo: Restar 500 puntos
{
  "puntos": -500,
  "operation": "add",
  "motivo": "Penalización"
}
```
- ✅ **Ventajas**:
  - Más seguro en concurrencia
  - Evita race conditions
  - Permite sumar/restar fácilmente
  - No permite que los puntos sean negativos (mínimo 0)

### 2. `operation: "set"` - Establecer Puntos (por defecto)
```javascript
// Ejemplo: Establecer puntos a 50000
{
  "puntos": 50000,
  "operation": "set",
  "motivo": "Reseteo de puntos"
}
```
- ⚠️ **Notas**:
  - Este es el comportamiento por defecto si no se especifica `operation`
  - No permite valores negativos
  - Útil para correcciones o reseteos

## 🔧 Actualización del Frontend

### Paso 1: Actualizar el Hook/Service

**Antes:**
```typescript
const actualizarPuntos = async (usuarioId: number, puntos: number, motivo: string) => {
  const response = await api.put(`/usuarios/${usuarioId}/puntos`, {
    puntos,
    motivo
  });
  return response.data;
};
```

**Después:**
```typescript
const actualizarPuntos = async (
  usuarioId: number, 
  puntos: number, 
  motivo: string,
  operation: 'add' | 'set' = 'add' // Por defecto usar 'add'
) => {
  const response = await api.put(`/usuarios/${usuarioId}/puntos`, {
    puntos,
    motivo,
    operation
  });
  return response.data;
};
```

### Paso 2: Actualizar el Componente

**Simplificación en el Modal/Componente:**
```typescript
const handleSavePuntos = async () => {
  try {
    // Ya NO necesitas calcular el cambio en el frontend
    // El backend lo hace por ti según el operation
    
    await actualizarPuntos(
      selectedUser.id,
      puntos,  // El valor directo del input
      motivo,
      puntosMode  // 'add' o 'set' según lo que eligió el usuario
    );
    
    toast.success('Puntos actualizados correctamente');
    refetch();
  } catch (error) {
    toast.error('Error al actualizar puntos');
  }
};
```

**Ejemplo completo del componente:**
```typescript
const [puntosMode, setPuntosMode] = useState<'add' | 'set'>('add');
const [puntos, setPuntos] = useState(0);
const [motivo, setMotivo] = useState('');

// Botones de modo
<div className="flex gap-2">
  <Button 
    variant={puntosMode === 'add' ? 'primary' : 'outline'}
    onClick={() => setPuntosMode('add')}
  >
    ➕ Sumar/Restar
  </Button>
  <Button 
    variant={puntosMode === 'set' ? 'primary' : 'outline'}
    onClick={() => setPuntosMode('set')}
  >
    📝 Establecer
  </Button>
</div>

// Input de puntos
<Input
  type="number"
  value={puntos}
  onChange={(e) => setPuntos(Number(e.target.value))}
  placeholder={puntosMode === 'add' ? 'Cantidad a sumar/restar' : 'Puntos totales'}
/>

// Preview
{puntosMode === 'add' ? (
  <div>
    {puntos >= 0 ? '➕' : '➖'} 
    {Math.abs(puntos)} puntos
    <br />
    Nuevo total: {Math.max(0, (selectedUser?.puntos || 0) + puntos)}
  </div>
) : (
  <div>
    📝 Establecer a: {puntos} puntos
  </div>
)}

// Guardar
<Button onClick={handleSavePuntos}>
  Guardar
</Button>
```

## 📊 Respuesta del Backend

```json
{
  "message": "Puntos actualizados correctamente",
  "usuario": {
    "id": 123,
    "nickname": "usuario_ejemplo",
    "puntosAnteriores": 5000,
    "puntosNuevos": 6000,
    "cambio": 1000
  },
  "operation": "add",
  "motivo": "Bonus por evento",
  "administrador": "admin_nickname"
}
```

## 🔍 Validaciones

### Backend:
- ✅ `operation` debe ser `'add'` o `'set'`
- ✅ `puntos` debe ser un número válido
- ✅ Para `operation: 'set'`, puntos no puede ser negativo
- ✅ Para `operation: 'add'`, puntos puede ser negativo (restar)
- ✅ Los puntos nunca pueden ser menores a 0 (se ajusta automáticamente)
- ✅ `motivo` es obligatorio

### Frontend:
- Validar que el input no esté vacío
- Para modo 'set', no permitir números negativos
- Para modo 'add', permitir positivos y negativos

## 🎨 Historial de Puntos

El concepto en el historial ahora incluye la operación:
```
"Ajuste de puntos [SUMA/RESTA]: Bonus por evento (Admin: admin123)"
"Ajuste de puntos [ESTABLECER]: Reset de puntos (Admin: admin123)"
```

## 🚀 Migración

### Si ya tienes código del frontend funcionando:

1. Actualiza el servicio/hook para incluir el parámetro `operation`
2. Simplifica el componente - ya no necesitas calcular `cambioPuntos`
3. Envía directamente el valor del input con el `operation` correspondiente
4. El backend se encarga de todo lo demás

### Retrocompatibilidad:

Si no envías `operation`, el backend usa `'set'` por defecto, manteniendo el comportamiento anterior.

## 📝 Ejemplos de Uso

### Sumar 1000 puntos:
```bash
curl -X PUT http://localhost:3001/api/usuarios/123/puntos \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "puntos": 1000,
    "operation": "add",
    "motivo": "Bonus por stream"
  }'
```

### Restar 500 puntos:
```bash
curl -X PUT http://localhost:3001/api/usuarios/123/puntos \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "puntos": -500,
    "operation": "add",
    "motivo": "Penalización"
  }'
```

### Establecer a 50000 puntos:
```bash
curl -X PUT http://localhost:3001/api/usuarios/123/puntos \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "puntos": 50000,
    "operation": "set",
    "motivo": "Reset de temporada"
  }'
```

## ✨ Beneficios

1. **Más claro**: El intention es explícito (`add` vs `set`)
2. **Más seguro**: El backend controla la lógica, evita race conditions
3. **Más simple**: El frontend solo envía el valor directo
4. **Más flexible**: Puedes sumar, restar o establecer puntos fácilmente
5. **Mejor validación**: El backend puede validar según la operación

---

**Fecha de implementación**: 4 de diciembre de 2025
**Versión**: 2.0
