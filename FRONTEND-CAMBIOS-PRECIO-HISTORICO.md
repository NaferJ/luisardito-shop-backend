# 🎨 Frontend - Cambios para Precio Histórico en Canjes

**Fecha:** 4 de diciembre de 2025  
**Relacionado con:** `IMPLEMENTACION-PRECIO-HISTORICO.md`

---

## 📋 RESUMEN

El backend ahora incluye el campo `precio_al_canje` en todos los endpoints de canjes. Este campo contiene el precio exacto que se pagó al momento del canje, permitiendo mostrar información histórica precisa.

---

## ✅ BUENAS NOTICIAS: CAMBIOS MÍNIMOS

**El backend ya devuelve automáticamente `precio_al_canje` en todos los endpoints de canjes**, por lo que:

- ✅ **No necesitas cambiar las llamadas a la API**
- ✅ **Los datos ya están disponibles en las respuestas**
- ✅ **Compatible con código existente** (incluye tanto `Producto.precio` como `precio_al_canje`)

---

## 🔍 QUÉ DEVUELVE EL BACKEND AHORA

### Estructura de un Canje (ejemplo):

```json
{
  "id": 42,
  "usuario_id": 123,
  "producto_id": 5,
  "precio_al_canje": 5000,  // ⬅️ NUEVO: Precio pagado en ese momento
  "estado": "entregado",
  "fecha": "2025-12-04T10:30:00.000Z",
  "Usuario": {
    "id": 123,
    "nickname": "usuarioEjemplo",
    "puntos": 15000
  },
  "Producto": {
    "id": 5,
    "nombre": "VIP 30 días",
    "descripcion": "Acceso VIP por 30 días",
    "precio": 4000,  // ⬅️ Precio ACTUAL (puede ser diferente al pagado)
    "stock": 10,
    "estado": "publicado"
  }
}
```

**Nota:** `precio_al_canje` = Precio pagado al momento del canje  
**Nota:** `Producto.precio` = Precio actual del producto (puede haber cambiado)

---

## 🎯 CAMBIOS RECOMENDADOS EN EL FRONTEND

### 1. **Quitar Validación que Impide Cambiar Precios** ⚠️ OBLIGATORIO

Si implementaste validación en el frontend que verifica `canjes_count` o canjes pendientes antes de permitir editar un producto, **debes removerla**.

#### ❌ Código a ELIMINAR (si existe):

```javascript
// Ejemplo en React/Vue/Angular
const handleEditProduct = (product) => {
  // ❌ REMOVER ESTA VALIDACIÓN
  if (product.canjes_count > 0) {
    alert('No se puede cambiar el precio porque hay canjes realizados');
    return;
  }
  
  // ❌ REMOVER ESTA VALIDACIÓN
  if (product.canjes_pendientes > 0) {
    alert('No se puede cambiar el precio porque hay canjes pendientes');
    return;
  }
  
  // Continuar con edición...
};
```

#### ✅ Código CORRECTO:

```javascript
// Simplemente permitir editar sin validaciones de canjes
const handleEditProduct = (product) => {
  // Abrir formulario de edición directamente
  openEditModal(product);
};
```

---

### 2. **Mostrar Precio Histórico en Canjes** (OPCIONAL pero recomendado)

Cuando muestres detalles de un canje, es útil mostrar el precio pagado si es diferente al precio actual.

#### ✅ Ejemplo en React:

```jsx
const CanjeCard = ({ canje }) => {
  const precioActual = canje.Producto?.precio;
  const precioPagado = canje.precio_al_canje || precioActual;
  const precioCambio = precioActual !== precioPagado;

  return (
    <div className="canje-card">
      <h3>{canje.Producto?.nombre}</h3>
      
      <div className="precio-info">
        <span className="label">Puntos pagados:</span>
        <span className="valor">{precioPagado?.toLocaleString()} pts</span>
        
        {precioCambio && (
          <span className="badge-cambio-precio" title="El precio del producto ha cambiado">
            Precio actual: {precioActual?.toLocaleString()} pts
          </span>
        )}
      </div>
      
      <div className="estado">
        <span className={`badge ${canje.estado}`}>
          {canje.estado}
        </span>
      </div>
    </div>
  );
};
```

#### ✅ Ejemplo en Vue:

```vue
<template>
  <div class="canje-card">
    <h3>{{ canje.Producto?.nombre }}</h3>
    
    <div class="precio-info">
      <span class="label">Puntos pagados:</span>
      <span class="valor">{{ precioPagado.toLocaleString() }} pts</span>
      
      <span v-if="precioCambio" class="badge-cambio-precio">
        Precio actual: {{ precioActual.toLocaleString() }} pts
      </span>
    </div>
    
    <div class="estado">
      <span :class="['badge', canje.estado]">
        {{ canje.estado }}
      </span>
    </div>
  </div>
</template>

<script>
export default {
  props: ['canje'],
  computed: {
    precioActual() {
      return this.canje.Producto?.precio;
    },
    precioPagado() {
      return this.canje.precio_al_canje || this.precioActual;
    },
    precioCambio() {
      return this.precioActual !== this.precioPagado;
    }
  }
};
</script>
```

---

### 3. **Tabla de Canjes (Admin)** (OPCIONAL)

Si tienes una tabla de canjes en el panel de admin, puedes agregar una columna para mostrar el precio pagado:

#### ✅ Ejemplo:

```jsx
<table className="canjes-table">
  <thead>
    <tr>
      <th>ID</th>
      <th>Usuario</th>
      <th>Producto</th>
      <th>Precio Pagado</th> {/* ⬅️ Nueva columna */}
      <th>Estado</th>
      <th>Fecha</th>
      <th>Acciones</th>
    </tr>
  </thead>
  <tbody>
    {canjes.map(canje => (
      <tr key={canje.id}>
        <td>{canje.id}</td>
        <td>{canje.Usuario?.nickname}</td>
        <td>{canje.Producto?.nombre}</td>
        <td>
          {(canje.precio_al_canje || canje.Producto?.precio).toLocaleString()} pts
          {canje.precio_al_canje !== canje.Producto?.precio && (
            <span className="tooltip" title={`Precio actual: ${canje.Producto?.precio}`}>
              ⓘ
            </span>
          )}
        </td>
        <td>
          <span className={`badge ${canje.estado}`}>
            {canje.estado}
          </span>
        </td>
        <td>{new Date(canje.fecha).toLocaleDateString()}</td>
        <td>
          <button onClick={() => handleAction(canje)}>Ver</button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

---

### 4. **Historial de Usuario ("Mis Canjes")** (OPCIONAL)

En la vista de "Mis Canjes", puedes mostrar cuántos puntos gastó el usuario:

```jsx
const MisCanjes = () => {
  const [canjes, setCanjes] = useState([]);
  
  useEffect(() => {
    fetch('/api/canjes/mios', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setCanjes(data));
  }, []);
  
  return (
    <div className="mis-canjes">
      <h2>Mis Canjes</h2>
      {canjes.map(canje => (
        <div key={canje.id} className="canje-item">
          <div className="producto">
            <h3>{canje.Producto?.nombre}</h3>
            <p>{canje.Producto?.descripcion}</p>
          </div>
          
          <div className="detalles">
            <span className="puntos-gastados">
              ✨ Gastaste: {canje.precio_al_canje?.toLocaleString() || canje.Producto?.precio?.toLocaleString()} pts
            </span>
            <span className="fecha">
              📅 {new Date(canje.fecha).toLocaleDateString()}
            </span>
            <span className={`estado ${canje.estado}`}>
              {canje.estado === 'pendiente' ? '⏳ Pendiente' :
               canje.estado === 'entregado' ? '✅ Entregado' :
               canje.estado === 'cancelado' ? '❌ Cancelado' :
               canje.estado === 'devuelto' ? '🔄 Devuelto' : canje.estado}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
```

---

## 🎨 CSS SUGERIDO (Opcional)

```css
/* Badge para indicar cambio de precio */
.badge-cambio-precio {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  font-size: 0.75rem;
  background-color: #fbbf24;
  color: #78350f;
  border-radius: 12px;
  cursor: help;
}

/* Tooltip para información adicional */
.tooltip {
  cursor: help;
  color: #6b7280;
  margin-left: 4px;
}

/* Destacar precio pagado vs actual */
.precio-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
}

.precio-info .label {
  color: #6b7280;
  font-size: 0.875rem;
}

.precio-info .valor {
  font-weight: 600;
  color: #1f2937;
  font-size: 1rem;
}
```

---

## 📊 RESUMEN DE CAMBIOS

| Cambio | Prioridad | Dificultad | Impacto |
|--------|-----------|------------|---------|
| **Remover validación de edición de precios** | 🔴 ALTA (Obligatorio) | ⭐ Baja | Permite editar productos |
| Mostrar precio histórico en detalles de canje | 🟡 Media (Recomendado) | ⭐⭐ Media | Mejor UX y transparencia |
| Agregar columna en tabla admin | 🟢 Baja (Opcional) | ⭐⭐ Media | Información más completa |
| Mostrar en "Mis Canjes" | 🟢 Baja (Opcional) | ⭐ Baja | Mejor información al usuario |

---

## ✅ CHECKLIST FRONTEND

- [ ] **Remover validación** que impide cambiar precios de productos con canjes
- [ ] (Opcional) Mostrar `precio_al_canje` en lugar de `Producto.precio` en historial de canjes
- [ ] (Opcional) Agregar indicador visual cuando el precio actual es diferente al pagado
- [ ] (Opcional) Actualizar tabla de admin para incluir precio histórico
- [ ] Probar en producción que se pueden editar precios sin errores

---

## 🧪 TESTING

### Validar que el campo está disponible:

```javascript
// En consola del navegador (después de cargar un canje):
fetch('/api/canjes/mios', {
  headers: { Authorization: 'Bearer YOUR_TOKEN' }
})
  .then(r => r.json())
  .then(data => {
    console.log('Primer canje:', data[0]);
    console.log('Tiene precio_al_canje:', !!data[0]?.precio_al_canje);
  });
```

**Resultado esperado:**
```javascript
{
  id: 42,
  producto_id: 5,
  precio_al_canje: 5000,  // ✅ Campo presente
  estado: "entregado",
  Producto: { precio: 4000 }  // Precio actual (puede ser diferente)
}
```

---

## 🚫 LO QUE NO NECESITAS HACER

- ❌ **NO** necesitas cambiar las URLs de la API
- ❌ **NO** necesitas agregar parámetros extra en las peticiones
- ❌ **NO** necesitas crear nuevos endpoints
- ❌ **NO** necesitas modificar la lógica de creación de canjes
- ❌ **NO** es obligatorio mostrar el precio histórico (es opcional)

---

## 💡 EJEMPLO DE IMPLEMENTACIÓN COMPLETA (React)

```jsx
import React, { useState, useEffect } from 'react';

const ProductEditModal = ({ product, onClose, onSave }) => {
  const [precio, setPrecio] = useState(product.precio);
  
  const handleSave = async () => {
    // ✅ Ya NO hay validación de canjes
    // Simplemente guardar el nuevo precio
    await fetch(`/api/productos/${product.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ precio })
    });
    
    onSave();
  };
  
  return (
    <div className="modal">
      <h2>Editar Producto</h2>
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <label>
          Precio (puntos):
          <input
            type="number"
            value={precio}
            onChange={(e) => setPrecio(Number(e.target.value))}
            min="0"
          />
        </label>
        
        {/* Información útil pero NO bloqueante */}
        {product.canjes_count > 0 && (
          <div className="info-box">
            ℹ️ Este producto tiene {product.canjes_count} canjes realizados.
            Los canjes pasados mantendrán su precio original.
          </div>
        )}
        
        <div className="actions">
          <button type="submit">Guardar</button>
          <button type="button" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </div>
  );
};

export default ProductEditModal;
```

---

## 🎯 CONCLUSIÓN

Los cambios en el frontend son **mínimos y opcionales**, excepto:

1. **Obligatorio:** Remover validación que impide editar precios
2. **Opcional:** Mostrar `precio_al_canje` para mejor UX

El backend ya está enviando toda la información necesaria, solo necesitas decidir cómo presentarla al usuario.

---

**¿Preguntas?** El campo `precio_al_canje` está disponible en:
- `GET /api/canjes` (lista todos los canjes - admin)
- `GET /api/canjes/mios` (mis canjes - usuario)
- `GET /api/canjes/:id` (detalle de un canje)
