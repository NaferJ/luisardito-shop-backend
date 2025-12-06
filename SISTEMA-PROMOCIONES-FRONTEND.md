# 🎉 Sistema de Promociones y Descuentos - Guía Frontend

## 📋 Índice
1. [Resumen del Sistema](#resumen-del-sistema)
2. [Estructura de Datos](#estructura-de-datos)
3. [Endpoints API Disponibles](#endpoints-api-disponibles)
4. [Casos de Uso Frontend](#casos-de-uso-frontend)
5. [Componentes UI Recomendados](#componentes-ui-recomendados)
6. [Ejemplos de Código](#ejemplos-de-código)
7. [Best Practices](#best-practices)

---

## 🎯 Resumen del Sistema

El backend ahora soporta un **sistema completo de promociones y descuentos** para la tienda de puntos de lealtad. Las características incluyen:

### ✨ Características Principales
- ✅ Descuentos por **porcentaje** o **puntos fijos**
- ✅ Descuentos especiales tipo **2x1** y **3x2**
- ✅ Promociones con **código de cupón** o automáticas
- ✅ **Límite de usos** totales y por usuario
- ✅ **Fechas de vigencia** con estados automáticos (programado, activo, expirado)
- ✅ **Prioridad** para resolver conflictos cuando hay múltiples descuentos
- ✅ **Metadata visual** personalizable (gradientes, badges, animaciones)
- ✅ **Tracking completo** de usos con estadísticas
- ✅ **Exportación a PDF** de reportes de promociones
- ✅ Los descuentos se aplican **automáticamente** en los endpoints de productos

---

## 📊 Estructura de Datos

### Objeto Promoción (Completo - Admin)
```typescript
interface Promocion {
  id: number;
  codigo: string | null;              // Código de cupón (ej: "VERANO2024")
  nombre: string;                      // Nombre interno
  titulo: string;                      // Título público
  descripcion: string | null;
  tipo: 'producto' | 'categoria' | 'global' | 'por_cantidad';
  tipo_descuento: 'porcentaje' | 'fijo' | '2x1' | '3x2';
  valor_descuento: number;             // Porcentaje (0-100) o puntos fijos
  descuento_maximo: number | null;     // Límite de descuento en puntos (solo porcentaje)
  fecha_inicio: string;                // ISO 8601
  fecha_fin: string;                   // ISO 8601
  cantidad_usos_maximos: number | null;
  cantidad_usos_actuales: number;
  usos_por_usuario: number;            // Default: 1
  minimo_puntos: number;               // Default: 0
  requiere_codigo: boolean;
  prioridad: number;                   // Mayor = más prioridad
  estado: 'activo' | 'programado' | 'expirado' | 'inactivo' | 'pausado';
  aplica_acumulacion: boolean;
  metadata_visual: MetadataVisual;
  reglas_aplicacion: ReglasAplicacion;
  creado_por: number | null;
  creado: string;
  actualizado: string;
  productos: Producto[];               // Array de productos asociados
}

interface MetadataVisual {
  badge: {
    texto: string;                     // ej: "OFERTA", "50% OFF", "BLACK FRIDAY"
    posicion: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    animacion: 'pulse' | 'bounce' | 'none';
  };
  gradiente: [string, string];         // Colores hex para degradado
  badge_color: string;                 // Color del badge
  mostrar_countdown: boolean;          // Mostrar cuenta regresiva
  mostrar_ahorro: boolean;             // Mostrar "Ahorras X puntos"
}

interface ReglasAplicacion {
  productos_ids: number[];
  categorias_ids: number[];
  excluir_productos_ids: number[];
  minimo_cantidad: number;
}
```

### Objeto Descuento (En Productos - Público)
```typescript
interface DescuentoProducto {
  tieneDescuento: boolean;
  precioOriginal: number;              // Precio sin descuento
  precioFinal: number;                 // Precio con descuento aplicado
  descuento: number;                   // Cantidad de puntos descontados
  porcentajeDescuento: string;         // "25" (sin el símbolo %)
  promocion: {
    id: number;
    codigo: string | null;
    titulo: string;
    descripcion: string;
    tipo_descuento: string;
    valor_descuento: number;
    fecha_fin: string;
    metadata_visual: MetadataVisual;
  } | null;
}
```

### Producto con Descuento (GET /api/productos)
```typescript
interface ProductoConDescuento {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;                      // Precio original
  stock: number;
  estado: string;
  imagen_url: string;
  slug: string;
  canjes_count: number;
  creado: string;
  actualizado: string;
  descuento: DescuentoProducto;        // ⭐ NUEVO
}
```

---

## 🔌 Endpoints API Disponibles

### 📦 Endpoints de Productos (Ya Modificados)

#### `GET /api/productos`
Lista todos los productos con información de descuentos automática.

**Headers:**
```
Authorization: Bearer <token>  // Opcional, mejora precisión de descuentos por usuario
```

**Response:**
```json
[
  {
    "id": 1,
    "nombre": "Teclado Gamer",
    "precio": 5000,
    "imagen_url": "...",
    "descuento": {
      "tieneDescuento": true,
      "precioOriginal": 5000,
      "precioFinal": 3750,
      "descuento": 1250,
      "porcentajeDescuento": "25",
      "promocion": {
        "id": 1,
        "titulo": "Black Friday",
        "tipo_descuento": "porcentaje",
        "valor_descuento": 25,
        "fecha_fin": "2025-12-31T23:59:59Z",
        "metadata_visual": {
          "badge": {
            "texto": "25% OFF",
            "posicion": "top-right",
            "animacion": "pulse"
          },
          "gradiente": ["#FF6B6B", "#FF8E53"],
          "badge_color": "#FF0000",
          "mostrar_countdown": true,
          "mostrar_ahorro": true
        }
      }
    }
  }
]
```

#### `GET /api/productos/:id`
Obtiene un producto específico con descuento.

**Response:** Igual estructura que arriba (objeto único).

#### `GET /api/productos/slug/:slug`
Obtiene un producto por slug con descuento.

**Response:** Igual estructura que arriba.

---

### 🎁 Endpoints de Promociones (Nuevos)

#### `GET /api/promociones/activas`
**Público** - Obtiene todas las promociones activas.

**Response:**
```json
[
  {
    "id": 1,
    "titulo": "Black Friday",
    "descripcion": "Descuento especial de temporada",
    "tipo_descuento": "porcentaje",
    "valor_descuento": 25,
    "fecha_fin": "2025-12-31T23:59:59Z",
    "metadata_visual": { ... },
    "productos": [
      {
        "id": 1,
        "nombre": "Teclado Gamer",
        "precio": 5000,
        "imagen_url": "...",
        "slug": "teclado-gamer"
      }
    ]
  }
]
```

---

#### `POST /api/promociones/validar-codigo`
**Requiere Auth Opcional** - Valida un código de cupón.

**Body:**
```json
{
  "codigo": "VERANO2024",
  "producto_id": 1  // Opcional
}
```

**Response (Válido):**
```json
{
  "valido": true,
  "promocion": {
    "id": 1,
    "titulo": "Verano 2024",
    "descripcion": "Descuento de verano",
    "tipo_descuento": "porcentaje",
    "valor_descuento": 15,
    "metadata_visual": { ... }
  }
}
```

**Response (Inválido):**
```json
{
  "valido": false,
  "mensaje": "Código de promoción inválido o expirado"
}
```

---

### 🔐 Endpoints Admin (Requieren Permiso `gestionar_productos`)

#### `GET /api/promociones`
Lista todas las promociones (con filtros).

**Query Params:**
- `estado`: `activo` | `programado` | `expirado` | `inactivo` | `pausado`
- `tipo`: `producto` | `categoria` | `global` | `por_cantidad`
- `activas_solo`: `true` | `false`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
[
  {
    "id": 1,
    "codigo": "VERANO2024",
    "nombre": "Promoción Verano",
    "titulo": "Verano 2024",
    "estado": "activo",
    "tipo_descuento": "porcentaje",
    "valor_descuento": 25,
    "fecha_inicio": "2025-06-01T00:00:00Z",
    "fecha_fin": "2025-08-31T23:59:59Z",
    "cantidad_usos_actuales": 150,
    "cantidad_usos_maximos": 1000,
    "productos": [ ... ]
  }
]
```

---

#### `POST /api/promociones`
Crear nueva promoción.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Body:**
```json
{
  "nombre": "Black Friday 2025",
  "titulo": "Black Friday",
  "descripcion": "Descuento especial de Black Friday",
  "tipo": "producto",
  "tipo_descuento": "porcentaje",
  "valor_descuento": 30,
  "descuento_maximo": 5000,
  "fecha_inicio": "2025-11-25T00:00:00Z",
  "fecha_fin": "2025-11-30T23:59:59Z",
  "cantidad_usos_maximos": 500,
  "usos_por_usuario": 1,
  "minimo_puntos": 1000,
  "requiere_codigo": false,
  "prioridad": 10,
  "estado": "programado",
  "aplica_acumulacion": false,
  "metadata_visual": {
    "badge": {
      "texto": "30% OFF",
      "posicion": "top-right",
      "animacion": "pulse"
    },
    "gradiente": ["#FF6B6B", "#FF8E53"],
    "badge_color": "#FF0000",
    "mostrar_countdown": true,
    "mostrar_ahorro": true
  },
  "productos_ids": [1, 2, 3, 5, 8]
}
```

**Response:** Objeto `Promocion` creado.

---

#### `PUT /api/promociones/:id`
Actualizar promoción existente.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Body:** Mismos campos que POST (todos opcionales, se actualizan solo los proporcionados).

**Response:** Objeto `Promocion` actualizado.

---

#### `DELETE /api/promociones/:id`
Eliminar promoción (soft delete - marca como `inactivo`).

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "mensaje": "Promoción eliminada exitosamente"
}
```

---

#### `DELETE /api/promociones/:id/permanente`
Eliminar promoción permanentemente de la BD.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "mensaje": "Promoción eliminada permanentemente"
}
```

---

#### `GET /api/promociones/:id/estadisticas`
Obtener estadísticas detalladas de una promoción.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "promocion": {
    "id": 1,
    "nombre": "Black Friday 2025",
    "titulo": "Black Friday",
    "estado": "activo",
    "fecha_inicio": "2025-11-25T00:00:00Z",
    "fecha_fin": "2025-11-30T23:59:59Z",
    "tipo_descuento": "porcentaje",
    "valor_descuento": 30
  },
  "estadisticas": {
    "total_usos": 245,
    "usos_maximos": 500,
    "puntos_descontados_total": 125000,
    "descuento_promedio": 510.2,
    "usuarios_unicos": 189,
    "productos_aplicables": 5
  },
  "topUsuarios": [
    {
      "usuario_id": 12,
      "usos": 3,
      "ahorro_total": 1500,
      "Usuario": {
        "username": "juan123",
        "email": "juan@example.com"
      }
    }
  ],
  "topProductos": [
    {
      "producto_id": 1,
      "canjes": 87,
      "Producto": {
        "nombre": "Teclado Gamer",
        "precio": 5000,
        "imagen_url": "..."
      }
    }
  ]
}
```

---

#### `GET /api/promociones/exportar-pdf`
Exportar reporte de promociones en PDF.

**Query Params:**
- `estado`: Filtrar por estado
- `activas_solo`: `true` | `false`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:** Archivo PDF descargable.

---

#### `PUT /api/promociones/actualizar-estados`
Actualizar estados de todas las promociones (convierte programadas en activas, activas en expiradas, etc.).

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "mensaje": "Estados de promociones actualizados correctamente"
}
```

---

## 🎨 Casos de Uso Frontend

### 1️⃣ **Mostrar Badge de Descuento en Card de Producto**

```tsx
// ProductCard.tsx
interface Props {
  producto: ProductoConDescuento;
}

export function ProductCard({ producto }: Props) {
  const { descuento } = producto;

  return (
    <div className="product-card">
      {/* Badge de descuento */}
      {descuento.tieneDescuento && descuento.promocion && (
        <div
          className={`badge badge-${descuento.promocion.metadata_visual.badge.posicion}`}
          style={{
            background: `linear-gradient(135deg, ${descuento.promocion.metadata_visual.gradiente[0]}, ${descuento.promocion.metadata_visual.gradiente[1]})`,
            animation: descuento.promocion.metadata_visual.badge.animacion === 'pulse' 
              ? 'pulse 2s infinite' 
              : 'none'
          }}
        >
          {descuento.promocion.metadata_visual.badge.texto}
        </div>
      )}

      <img src={producto.imagen_url} alt={producto.nombre} />
      
      <h3>{producto.nombre}</h3>

      {/* Precio con descuento */}
      <div className="price-container">
        {descuento.tieneDescuento ? (
          <>
            <span className="price-original">{descuento.precioOriginal} pts</span>
            <span className="price-final">{descuento.precioFinal} pts</span>
            {descuento.promocion?.metadata_visual.mostrar_ahorro && (
              <span className="ahorro">¡Ahorras {descuento.descuento} pts!</span>
            )}
          </>
        ) : (
          <span className="price-final">{producto.precio} pts</span>
        )}
      </div>

      {/* Countdown (si aplica) */}
      {descuento.tieneDescuento && 
       descuento.promocion?.metadata_visual.mostrar_countdown && (
        <Countdown fecha={descuento.promocion.fecha_fin} />
      )}
    </div>
  );
}
```

---

### 2️⃣ **Aplicar Código de Cupón**

```tsx
// CuponInput.tsx
import { useState } from 'react';
import api from './api';

export function CuponInput({ productoId }: { productoId: number }) {
  const [codigo, setCodigo] = useState('');
  const [validacion, setValidacion] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validarCodigo = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/api/promociones/validar-codigo', {
        codigo,
        producto_id: productoId
      });

      if (response.data.valido) {
        setValidacion(response.data.promocion);
        // Aplicar descuento en el carrito
      } else {
        setError(response.data.mensaje);
      }
    } catch (err: any) {
      setError(err.response?.data?.mensaje || 'Error al validar código');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cupon-input">
      <input
        type="text"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.toUpperCase())}
        placeholder="Código de cupón"
      />
      <button onClick={validarCodigo} disabled={loading || !codigo}>
        {loading ? 'Validando...' : 'Aplicar'}
      </button>

      {validacion && (
        <div className="cupon-success">
          ✓ {validacion.titulo} aplicado ({validacion.valor_descuento}% OFF)
        </div>
      )}

      {error && <div className="cupon-error">{error}</div>}
    </div>
  );
}
```

---

### 3️⃣ **Panel Admin - CRUD de Promociones**

```tsx
// AdminPromociones.tsx
import { useState, useEffect } from 'react';
import api from './api';

export function AdminPromociones() {
  const [promociones, setPromociones] = useState([]);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    cargarPromociones();
  }, [filtro]);

  const cargarPromociones = async () => {
    const params = filtro ? { estado: filtro } : {};
    const response = await api.get('/api/promociones', { params });
    setPromociones(response.data);
  };

  const exportarPDF = async () => {
    const response = await api.get('/api/promociones/exportar-pdf', {
      responseType: 'blob',
      params: filtro ? { estado: filtro } : {}
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `promociones-${Date.now()}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const eliminarPromocion = async (id: number) => {
    if (!confirm('¿Eliminar esta promoción?')) return;
    
    await api.delete(`/api/promociones/${id}`);
    cargarPromociones();
  };

  return (
    <div className="admin-promociones">
      <div className="header">
        <h1>Gestión de Promociones</h1>
        <div className="actions">
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todas</option>
            <option value="activo">Activas</option>
            <option value="programado">Programadas</option>
            <option value="expirado">Expiradas</option>
          </select>
          <button onClick={exportarPDF}>📄 Exportar PDF</button>
          <button onClick={() => window.location.href = '/admin/promociones/crear'}>
            ➕ Nueva Promoción
          </button>
        </div>
      </div>

      <table className="promociones-table">
        <thead>
          <tr>
            <th>Título</th>
            <th>Estado</th>
            <th>Descuento</th>
            <th>Vigencia</th>
            <th>Usos</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {promociones.map((promo: any) => (
            <tr key={promo.id}>
              <td>{promo.titulo}</td>
              <td>
                <span className={`badge-estado ${promo.estado}`}>
                  {promo.estado}
                </span>
              </td>
              <td>
                {promo.tipo_descuento === 'porcentaje' 
                  ? `${promo.valor_descuento}%` 
                  : `${promo.valor_descuento} pts`}
              </td>
              <td>
                {new Date(promo.fecha_inicio).toLocaleDateString()} - 
                {new Date(promo.fecha_fin).toLocaleDateString()}
              </td>
              <td>
                {promo.cantidad_usos_actuales} / 
                {promo.cantidad_usos_maximos || '∞'}
              </td>
              <td>
                <button onClick={() => window.location.href = `/admin/promociones/${promo.id}`}>
                  ✏️ Editar
                </button>
                <button onClick={() => window.location.href = `/admin/promociones/${promo.id}/estadisticas`}>
                  📊 Stats
                </button>
                <button onClick={() => eliminarPromocion(promo.id)}>
                  🗑️ Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

### 4️⃣ **Formulario Crear/Editar Promoción**

```tsx
// FormPromocion.tsx
import { useState } from 'react';
import api from './api';

export function FormPromocion({ promocionId }: { promocionId?: number }) {
  const [formData, setFormData] = useState({
    nombre: '',
    titulo: '',
    descripcion: '',
    tipo: 'producto',
    tipo_descuento: 'porcentaje',
    valor_descuento: 0,
    descuento_maximo: null,
    fecha_inicio: '',
    fecha_fin: '',
    cantidad_usos_maximos: null,
    usos_por_usuario: 1,
    requiere_codigo: false,
    codigo: '',
    prioridad: 0,
    productos_ids: [],
    metadata_visual: {
      badge: {
        texto: 'OFERTA',
        posicion: 'top-right',
        animacion: 'pulse'
      },
      gradiente: ['#FF6B6B', '#FF8E53'],
      badge_color: '#FF0000',
      mostrar_countdown: true,
      mostrar_ahorro: true
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (promocionId) {
        await api.put(`/api/promociones/${promocionId}`, formData);
      } else {
        await api.post('/api/promociones', formData);
      }
      
      alert('Promoción guardada exitosamente');
      window.location.href = '/admin/promociones';
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al guardar');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-promocion">
      <h2>{promocionId ? 'Editar' : 'Crear'} Promoción</h2>

      <div className="form-group">
        <label>Título Público *</label>
        <input
          type="text"
          value={formData.titulo}
          onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
          required
        />
      </div>

      <div className="form-group">
        <label>Nombre Interno *</label>
        <input
          type="text"
          value={formData.nombre}
          onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Tipo de Descuento *</label>
          <select
            value={formData.tipo_descuento}
            onChange={(e) => setFormData({ ...formData, tipo_descuento: e.target.value })}
            required
          >
            <option value="porcentaje">Porcentaje</option>
            <option value="fijo">Puntos Fijos</option>
            <option value="2x1">2x1</option>
            <option value="3x2">3x2</option>
          </select>
        </div>

        <div className="form-group">
          <label>Valor del Descuento *</label>
          <input
            type="number"
            value={formData.valor_descuento}
            onChange={(e) => setFormData({ ...formData, valor_descuento: Number(e.target.value) })}
            min="0"
            max={formData.tipo_descuento === 'porcentaje' ? 100 : undefined}
            required
          />
          <small>
            {formData.tipo_descuento === 'porcentaje' ? '(0-100)' : '(puntos)'}
          </small>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Fecha Inicio *</label>
          <input
            type="datetime-local"
            value={formData.fecha_inicio}
            onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label>Fecha Fin *</label>
          <input
            type="datetime-local"
            value={formData.fecha_fin}
            onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={formData.requiere_codigo}
            onChange={(e) => setFormData({ ...formData, requiere_codigo: e.target.checked })}
          />
          Requiere código de cupón
        </label>
      </div>

      {formData.requiere_codigo && (
        <div className="form-group">
          <label>Código de Cupón</label>
          <input
            type="text"
            value={formData.codigo}
            onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
            placeholder="VERANO2024"
          />
        </div>
      )}

      <div className="form-group">
        <label>Productos Aplicables *</label>
        <ProductosSelector
          value={formData.productos_ids}
          onChange={(ids) => setFormData({ ...formData, productos_ids: ids })}
        />
      </div>

      {/* Badge Configuration */}
      <fieldset>
        <legend>Configuración Visual</legend>
        
        <div className="form-group">
          <label>Texto del Badge</label>
          <input
            type="text"
            value={formData.metadata_visual.badge.texto}
            onChange={(e) => setFormData({
              ...formData,
              metadata_visual: {
                ...formData.metadata_visual,
                badge: { ...formData.metadata_visual.badge, texto: e.target.value }
              }
            })}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Color Gradiente 1</label>
            <input
              type="color"
              value={formData.metadata_visual.gradiente[0]}
              onChange={(e) => setFormData({
                ...formData,
                metadata_visual: {
                  ...formData.metadata_visual,
                  gradiente: [e.target.value, formData.metadata_visual.gradiente[1]]
                }
              })}
            />
          </div>

          <div className="form-group">
            <label>Color Gradiente 2</label>
            <input
              type="color"
              value={formData.metadata_visual.gradiente[1]}
              onChange={(e) => setFormData({
                ...formData,
                metadata_visual: {
                  ...formData.metadata_visual,
                  gradiente: [formData.metadata_visual.gradiente[0], e.target.value]
                }
              })}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Animación</label>
          <select
            value={formData.metadata_visual.badge.animacion}
            onChange={(e) => setFormData({
              ...formData,
              metadata_visual: {
                ...formData.metadata_visual,
                badge: { ...formData.metadata_visual.badge, animacion: e.target.value }
              }
            })}
          >
            <option value="none">Sin animación</option>
            <option value="pulse">Pulso</option>
            <option value="bounce">Rebote</option>
          </select>
        </div>
      </fieldset>

      <div className="form-actions">
        <button type="button" onClick={() => window.history.back()}>
          Cancelar
        </button>
        <button type="submit" className="primary">
          {promocionId ? 'Actualizar' : 'Crear'} Promoción
        </button>
      </div>
    </form>
  );
}
```

---

## 🎨 Componentes UI Recomendados

### Badge con Animación
```css
.badge {
  position: absolute;
  padding: 8px 16px;
  border-radius: 8px;
  color: white;
  font-weight: bold;
  font-size: 12px;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.badge-top-right {
  top: 12px;
  right: 12px;
}

.badge-top-left {
  top: 12px;
  left: 12px;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
```

### Precio con Descuento
```css
.price-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.price-original {
  text-decoration: line-through;
  color: #999;
  font-size: 14px;
}

.price-final {
  color: #27ae60;
  font-size: 24px;
  font-weight: bold;
}

.ahorro {
  color: #e74c3c;
  font-size: 12px;
  font-weight: 600;
}
```

### Countdown Timer
```tsx
// Countdown.tsx
import { useState, useEffect } from 'react';

export function Countdown({ fecha }: { fecha: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date(fecha).getTime() - Date.now();
      
      if (diff <= 0) {
        setTimeLeft('¡Promoción terminada!');
        clearInterval(interval);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [fecha]);

  return (
    <div className="countdown">
      ⏰ Termina en: <strong>{timeLeft}</strong>
    </div>
  );
}
```

---

## ✅ Best Practices

### 1. **Caching de Promociones Activas**
```tsx
// usePromociones.hook.ts
import { useQuery } from 'react-query';
import api from './api';

export function usePromocionesActivas() {
  return useQuery(
    ['promociones', 'activas'],
    () => api.get('/api/promociones/activas').then(r => r.data),
    {
      staleTime: 5 * 60 * 1000, // 5 minutos
      cacheTime: 10 * 60 * 1000 // 10 minutos
    }
  );
}
```

### 2. **Validación de Fechas**
Siempre valida en el frontend que `fecha_fin > fecha_inicio` antes de enviar.

### 3. **Mostrar Descuento Solo si Existe**
```tsx
{producto.descuento.tieneDescuento && (
  // Tu código aquí
)}
```

### 4. **Formatear Puntos**
```tsx
const formatearPuntos = (puntos: number) => {
  return new Intl.NumberFormat('es-MX').format(puntos);
};
```

### 5. **Manejo de Errores**
```tsx
try {
  await api.post('/api/promociones', data);
} catch (error: any) {
  if (error.response?.status === 400) {
    alert(error.response.data.error);
  } else {
    alert('Error desconocido');
  }
}
```

---

## 🚀 Próximos Pasos

### Backend ya implementado:
- ✅ Modelos y migraciones
- ✅ Servicio de lógica de negocio
- ✅ Controladores CRUD
- ✅ Rutas y permisos
- ✅ Integración con productos
- ✅ Exportación PDF

### Tú debes implementar en Frontend:
1. **Vista Admin** - CRUD de promociones
2. **Vista Admin** - Estadísticas de promociones
3. **Vista Pública** - Cards de productos con badges
4. **Vista Pública** - Página de promociones activas
5. **Componente** - Validador de códigos de cupón
6. **Componente** - Countdown timer
7. **Styling** - CSS para badges, precios, etc.

---

## 📞 Soporte

Si tienes dudas sobre algún endpoint o necesitas ajustar algo del backend, revisa:
- `src/models/promocion.model.js` - Modelo principal
- `src/services/promocion.service.js` - Lógica de negocio
- `src/controllers/promociones.controller.js` - Endpoints

---

## 🎉 ¡Listo para Usar!

El sistema está **100% funcional** en el backend. Solo necesitas:

1. **Ejecutar migraciones:**
   ```bash
   npm run migrate
   ```

2. **Reiniciar el servidor:**
   ```bash
   npm run dev
   ```

3. **Crear tu primera promoción** desde Postman o tu panel admin.

4. **Ver los descuentos automáticamente** en `GET /api/productos`.

¡Disfruta del sistema de promociones más moderno y completo! 🚀🎁
