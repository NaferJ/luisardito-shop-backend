# 🎨 Guía Frontend - Sistema de Comandos del Bot

## 📋 Índice
1. [Vista General](#vista-general)
2. [Componentes Necesarios](#componentes-necesarios)
3. [Estructura de Datos](#estructura-de-datos)
4. [Funciones de API](#funciones-de-api)
5. [Mockups y Diseño](#mockups-y-diseño)
6. [Validaciones](#validaciones)
7. [Estados y Mensajes](#estados-y-mensajes)

---

## 🎯 Vista General

El frontend debe permitir a los administradores gestionar comandos del bot de forma visual e intuitiva, sin necesidad de conocimientos técnicos.

### Funcionalidades Principales
- ✅ Listar comandos con paginación
- ✅ Crear/Editar/Eliminar comandos
- ✅ Habilitar/Deshabilitar comandos (toggle)
- ✅ Duplicar comandos
- ✅ Probar comandos antes de guardar
- ✅ Ver estadísticas de uso
- ✅ Filtrar y buscar comandos

---

## 🧩 Componentes Necesarios

### 1. Lista de Comandos (Tabla)
```
┌─────────────────────────────────────────────────────────────────────────┐
│  🤖 Comandos del Bot                                    [+ Nuevo Comando]│
├─────────────────────────────────────────────────────────────────────────┤
│  Buscar: [_____________________]  Tipo: [Todos ▼]  Estado: [Todos ▼]   │
├────────┬─────────┬──────────────┬────────┬──────────┬───────────────────┤
│ Estado │ Comando │ Descripción  │  Tipo  │ Usos     │ Acciones          │
├────────┼─────────┼──────────────┼────────┼──────────┼───────────────────┤
│ 🟢     │ tienda  │ Muestra la   │ Simple │ 1,234    │ [✏️] [📋] [🗑️]   │
│        │ (shop)  │ tienda...    │        │          │ [🔄]              │
├────────┼─────────┼──────────────┼────────┼──────────┼───────────────────┤
│ 🟢     │ puntos  │ Consulta     │ Dynamic│ 5,678    │ [✏️] [📋] [🗑️]   │
│        │         │ puntos...    │        │          │ [🔄]              │
├────────┼─────────┼──────────────┼────────┼──────────┼───────────────────┤
│ 🔴     │ discord │ Enlace       │ Simple │ 89       │ [✏️] [📋] [🗑️]   │
│        │ (dc)    │ Discord...   │        │          │ [🔄]              │
└────────┴─────────┴──────────────┴────────┴──────────┴───────────────────┘
                           Página 1 de 3   [< Anterior] [Siguiente >]
```

**Props del Componente:**
```typescript
interface CommandListProps {
  commands: Command[];
  loading: boolean;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onToggle: (id: number) => void;
  onDuplicate: (id: number) => void;
  onPageChange: (page: number) => void;
  onSearch: (query: string) => void;
  onFilterChange: (filters: Filters) => void;
}
```

---

### 2. Formulario Crear/Editar Comando

```
┌─────────────────────────────────────────────────────────────────┐
│  ✨ Nuevo Comando                                    [X Cerrar] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Nombre del Comando *                                           │
│  [!____________]                                                │
│  El símbolo ! se agrega automáticamente                         │
│                                                                 │
│  Aliases (separados por coma)                                   │
│  [shop, store, tienda]                                          │
│                                                                 │
│  Descripción                                                    │
│  [Muestra el enlace de la tienda del canal_____________]        │
│                                                                 │
│  Mensaje de Respuesta *                                         │
│  ┌───────────────────────────────────────────────────┐         │
│  │ {channel} tienda del canal:                       │         │
│  │ https://shop.luisardito.com/                      │         │
│  │                                                   │         │
│  └───────────────────────────────────────────────────┘         │
│  Variables: {username} {channel} {args}                         │
│                                                                 │
│  Tipo de Comando                                                │
│  ⚪ Simple (respuesta estática)                                 │
│  ⚪ Dinámico (lógica especial)                                  │
│                                                                 │
│  ⚙️ Configuración Avanzada                          [Expandir ▼]│
│                                                                 │
│  ☐ Requiere permisos especiales                                │
│  Nivel de permiso: [Viewer ▼]                                  │
│                                                                 │
│  Cooldown: [30] segundos                                        │
│                                                                 │
│  Estado: ☑ Habilitado                                          │
│                                                                 │
│  [🧪 Probar Comando]                [Cancelar] [💾 Guardar]    │
└─────────────────────────────────────────────────────────────────┘
```

**Props del Componente:**
```typescript
interface CommandFormProps {
  command?: Command | null; // null = crear, Command = editar
  onSave: (command: CommandFormData) => Promise<void>;
  onCancel: () => void;
  onTest: (message: string) => void;
}

interface CommandFormData {
  command: string;
  aliases: string[];
  response_message: string;
  description?: string;
  command_type: 'simple' | 'dynamic';
  dynamic_handler?: string;
  enabled: boolean;
  requires_permission: boolean;
  permission_level?: 'viewer' | 'vip' | 'moderator' | 'broadcaster';
  cooldown_seconds: number;
}
```

---

### 3. Modal de Prueba de Comando

```
┌─────────────────────────────────────────────────────────┐
│  🧪 Probar Comando                          [X Cerrar]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Mensaje Original:                                      │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Hola {username}, bienvenido a {channel}!          │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Usuario de Prueba:                                     │
│  [JuanPerez__________________]                          │
│                                                         │
│  Argumentos (opcional):                                 │
│  [arg1 arg2__________________]                          │
│                                                         │
│  📤 Resultado:                                          │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ✅ Hola JuanPerez, bienvenido a luisardito!       │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│                              [Cerrar] [🧪 Probar Otra Vez]│
└─────────────────────────────────────────────────────────┘
```

---

### 4. Panel de Estadísticas

```
┌─────────────────────────────────────────────────────────────────────┐
│  📊 Estadísticas de Comandos                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Total        │  │ Habilitados  │  │ Deshabilitados│             │
│  │     15       │  │      12      │  │       3      │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                     │
│  🔥 Comandos Más Usados                                            │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ 1. !puntos        5,678 usos    ████████████████████ 100%  │  │
│  │ 2. !tienda        1,234 usos    ██████ 22%                 │  │
│  │ 3. !discord         567 usos    ███ 10%                    │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  🕐 Últimos Comandos Usados                                        │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ !puntos    •  Hace 2 minutos                                │  │
│  │ !tienda    •  Hace 5 minutos                                │  │
│  │ !discord   •  Hace 10 minutos                               │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Estructura de Datos

### Modelo de Comando (TypeScript)

```typescript
interface Command {
  id: number;
  command: string;
  aliases: string[];
  response_message: string;
  description?: string;
  command_type: 'simple' | 'dynamic';
  dynamic_handler?: string;
  enabled: boolean;
  requires_permission: boolean;
  permission_level: 'viewer' | 'vip' | 'moderator' | 'broadcaster';
  cooldown_seconds: number;
  usage_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

interface CommandStats {
  summary: {
    total: number;
    enabled: number;
    disabled: number;
    simple: number;
    dynamic: number;
  };
  mostUsed: Array<{
    id: number;
    command: string;
    usage_count: number;
    last_used_at?: string;
  }>;
  recentlyUsed: Array<{
    id: number;
    command: string;
    usage_count: number;
    last_used_at?: string;
  }>;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: Pagination;
}
```

---

## 🔌 Funciones de API

### Servicio de Comandos (React/Vue/Angular)

```typescript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api/kick-admin/bot-commands';

class CommandsService {
  private getHeaders() {
    const token = localStorage.getItem('authToken');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  // Listar todos los comandos
  async getAll(params?: {
    page?: number;
    limit?: number;
    enabled?: boolean;
    command_type?: string;
    search?: string;
  }): Promise<ApiResponse<Command[]>> {
    const response = await axios.get(API_BASE_URL, {
      headers: this.getHeaders(),
      params
    });
    return response.data;
  }

  // Obtener comando por ID
  async getById(id: number): Promise<ApiResponse<Command>> {
    const response = await axios.get(`${API_BASE_URL}/${id}`, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  // Crear comando
  async create(command: CommandFormData): Promise<ApiResponse<Command>> {
    const response = await axios.post(API_BASE_URL, command, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  // Actualizar comando
  async update(id: number, command: Partial<CommandFormData>): Promise<ApiResponse<Command>> {
    const response = await axios.put(`${API_BASE_URL}/${id}`, command, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  // Eliminar comando
  async delete(id: number): Promise<ApiResponse<void>> {
    const response = await axios.delete(`${API_BASE_URL}/${id}`, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  // Toggle enabled/disabled
  async toggle(id: number): Promise<ApiResponse<Command>> {
    const response = await axios.patch(`${API_BASE_URL}/${id}/toggle`, {}, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  // Duplicar comando
  async duplicate(id: number): Promise<ApiResponse<Command>> {
    const response = await axios.post(`${API_BASE_URL}/${id}/duplicate`, {}, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  // Obtener estadísticas
  async getStats(): Promise<ApiResponse<CommandStats>> {
    const response = await axios.get(`${API_BASE_URL}/stats`, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  // Probar comando
  async test(data: {
    response_message: string;
    test_username?: string;
    test_args?: string;
  }): Promise<ApiResponse<any>> {
    const response = await axios.post(`${API_BASE_URL}/test`, data, {
      headers: this.getHeaders()
    });
    return response.data;
  }
}

export default new CommandsService();
```

---

## 🎨 Ejemplo de Componente React

```tsx
import React, { useState, useEffect } from 'react';
import CommandsService from './services/CommandsService';
import CommandList from './components/CommandList';
import CommandForm from './components/CommandForm';
import CommandStats from './components/CommandStats';

const BotCommandsPage: React.FC = () => {
  const [commands, setCommands] = useState<Command[]>([]);
  const [stats, setStats] = useState<CommandStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0
  });
  const [showForm, setShowForm] = useState(false);
  const [editingCommand, setEditingCommand] = useState<Command | null>(null);

  // Cargar comandos
  const loadCommands = async (page = 1, filters = {}) => {
    setLoading(true);
    try {
      const response = await CommandsService.getAll({ page, ...filters });
      if (response.ok && response.data) {
        setCommands(response.data);
        if (response.pagination) {
          setPagination(response.pagination);
        }
      }
    } catch (error) {
      console.error('Error cargando comandos:', error);
      alert('Error al cargar comandos');
    } finally {
      setLoading(false);
    }
  };

  // Cargar estadísticas
  const loadStats = async () => {
    try {
      const response = await CommandsService.getStats();
      if (response.ok && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  useEffect(() => {
    loadCommands();
    loadStats();
  }, []);

  // Crear comando
  const handleCreate = async (data: CommandFormData) => {
    try {
      const response = await CommandsService.create(data);
      if (response.ok) {
        alert('Comando creado exitosamente');
        setShowForm(false);
        loadCommands();
        loadStats();
      }
    } catch (error) {
      console.error('Error creando comando:', error);
      alert('Error al crear comando');
    }
  };

  // Editar comando
  const handleEdit = async (data: CommandFormData) => {
    if (!editingCommand) return;
    
    try {
      const response = await CommandsService.update(editingCommand.id, data);
      if (response.ok) {
        alert('Comando actualizado exitosamente');
        setShowForm(false);
        setEditingCommand(null);
        loadCommands();
      }
    } catch (error) {
      console.error('Error actualizando comando:', error);
      alert('Error al actualizar comando');
    }
  };

  // Eliminar comando
  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este comando?')) return;
    
    try {
      const response = await CommandsService.delete(id);
      if (response.ok) {
        alert('Comando eliminado exitosamente');
        loadCommands();
        loadStats();
      }
    } catch (error) {
      console.error('Error eliminando comando:', error);
      alert('Error al eliminar comando');
    }
  };

  // Toggle comando
  const handleToggle = async (id: number) => {
    try {
      const response = await CommandsService.toggle(id);
      if (response.ok) {
        loadCommands();
      }
    } catch (error) {
      console.error('Error alternando comando:', error);
      alert('Error al cambiar estado del comando');
    }
  };

  // Duplicar comando
  const handleDuplicate = async (id: number) => {
    try {
      const response = await CommandsService.duplicate(id);
      if (response.ok) {
        alert('Comando duplicado exitosamente');
        loadCommands();
      }
    } catch (error) {
      console.error('Error duplicando comando:', error);
      alert('Error al duplicar comando');
    }
  };

  return (
    <div className="bot-commands-page">
      <h1>🤖 Comandos del Bot</h1>
      
      {/* Estadísticas */}
      {stats && <CommandStats stats={stats} />}
      
      {/* Botón crear */}
      <button onClick={() => {
        setEditingCommand(null);
        setShowForm(true);
      }}>
        ➕ Nuevo Comando
      </button>
      
      {/* Lista de comandos */}
      <CommandList
        commands={commands}
        loading={loading}
        pagination={pagination}
        onEdit={(id) => {
          const cmd = commands.find(c => c.id === id);
          setEditingCommand(cmd || null);
          setShowForm(true);
        }}
        onDelete={handleDelete}
        onToggle={handleToggle}
        onDuplicate={handleDuplicate}
        onPageChange={loadCommands}
        onSearch={(query) => loadCommands(1, { search: query })}
        onFilterChange={(filters) => loadCommands(1, filters)}
      />
      
      {/* Formulario */}
      {showForm && (
        <CommandForm
          command={editingCommand}
          onSave={editingCommand ? handleEdit : handleCreate}
          onCancel={() => {
            setShowForm(false);
            setEditingCommand(null);
          }}
          onTest={async (message) => {
            const response = await CommandsService.test({
              response_message: message,
              test_username: 'TestUser'
            });
            if (response.ok && response.data) {
              alert(`Resultado: ${response.data.processed}`);
            }
          }}
        />
      )}
    </div>
  );
};

export default BotCommandsPage;
```

---

## ✅ Validaciones

### Frontend Validations

```typescript
const validateCommand = (data: CommandFormData): string[] => {
  const errors: string[] = [];

  // Validar comando
  if (!data.command || data.command.trim() === '') {
    errors.push('El nombre del comando es obligatorio');
  } else if (!/^[a-z0-9_]+$/i.test(data.command)) {
    errors.push('El comando solo puede contener letras, números y guiones bajos');
  }

  // Validar mensaje
  if (!data.response_message || data.response_message.trim() === '') {
    errors.push('El mensaje de respuesta es obligatorio');
  }

  // Validar tipo dinámico
  if (data.command_type === 'dynamic' && !data.dynamic_handler) {
    errors.push('Los comandos dinámicos requieren un handler');
  }

  // Validar cooldown
  if (data.cooldown_seconds < 0) {
    errors.push('El cooldown no puede ser negativo');
  }

  return errors;
};
```

---

## 💬 Estados y Mensajes

### Mensajes de Éxito
- ✅ "Comando creado exitosamente"
- ✅ "Comando actualizado exitosamente"
- ✅ "Comando eliminado exitosamente"
- ✅ "Comando habilitado exitosamente"
- ✅ "Comando deshabilitado exitosamente"
- ✅ "Comando duplicado exitosamente"

### Mensajes de Error
- ❌ "Error al crear el comando"
- ❌ "Error al actualizar el comando"
- ❌ "El comando ya existe"
- ❌ "Comando no encontrado"
- ❌ "Error de conexión con el servidor"
- ❌ "No tienes permisos para esta acción"

### Estados de Carga
- 🔄 "Cargando comandos..."
- 🔄 "Guardando..."
- 🔄 "Eliminando..."
- 🔄 "Procesando..."

---

## 🎨 Iconografía Sugerida

- 🤖 Bot/Comandos
- ➕ Crear
- ✏️ Editar
- 🗑️ Eliminar
- 🔄 Toggle/Duplicar
- 🧪 Probar
- 📊 Estadísticas
- 🟢 Habilitado
- 🔴 Deshabilitado
- 💾 Guardar
- ❌ Cancelar
- 🔍 Buscar
- ⚙️ Configuración

---

## 🔐 Consideraciones de Seguridad

1. **Autenticación:** Verificar token JWT válido
2. **Autorización:** Solo usuarios con rol `admin`
3. **Sanitización:** Limpiar inputs antes de enviar
4. **Validación:** Validar en frontend Y backend
5. **HTTPS:** Usar siempre HTTPS en producción

---

## 📱 Responsive Design

### Desktop (>1024px)
- Tabla completa con todas las columnas
- Formulario en modal
- Estadísticas en 3 columnas

### Tablet (768px - 1024px)
- Tabla con columnas esenciales
- Formulario en modal
- Estadísticas en 2 columnas

### Mobile (<768px)
- Cards en lugar de tabla
- Formulario fullscreen
- Estadísticas en 1 columna

---

## 🚀 Mejores Prácticas

1. **Feedback Visual:** Mostrar loading states y toasts
2. **Confirmaciones:** Pedir confirmación antes de eliminar
3. **Validación en Tiempo Real:** Validar mientras el usuario escribe
4. **Autoguardado:** Considerar guardar borradores automáticamente
5. **Búsqueda Instantánea:** Filtrar mientras se escribe
6. **Accesibilidad:** Usar aria-labels y navegación por teclado
7. **Optimización:** Lazy loading y paginación
8. **Error Handling:** Manejo robusto de errores

---

## 📚 Recursos Adicionales

- **API Completa:** `BOT-COMMANDS-SYSTEM.md`
- **Ejemplos de API:** `API-EJEMPLOS-COMANDOS.md`
- **Resumen Técnico:** `RESUMEN-COMANDOS-BOT.md`

---

**Última actualización:** 2025-11-25  
**Versión:** 1.0.0