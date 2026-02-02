# Setup: Lectura de Configs del Filesystem

Este documento detalla los pasos necesarios para que Awesome Shortcuts comience a leer configuraciones del filesystem del usuario.

---

## Estado Actual

### Ya Implementado

| Componente | Estado | Notas |
|------------|--------|-------|
| SQLite Database | ✅ Completo | Schema con 5 tablas, migrations, queries |
| Parsers | ✅ Completo | Neovim, Tmux, Zsh, VS Code |
| API Routes | ✅ Completo | `/api/config-paths`, `/api/shortcuts`, `/api/shortcuts/refresh` |
| Validación | ✅ Completo | Path validation, security checks |
| UI Components | ⚠️ Parcial | Estructura existe, usa mock data |

### Pendiente

| Componente | Prioridad | Descripción |
|------------|-----------|-------------|
| Integración UI ↔ API | 🔴 Alta | Conectar componentes con endpoints |
| Inicialización DB | 🔴 Alta | Auto-run migrations al iniciar |
| Docker Setup | 🟡 Media | Dockerfile + docker-compose.yml |
| File System Utils | 🟡 Media | Path expansion, directory monitoring |

---

## Pasos para Configurar

### Paso 1: Inicialización de la Base de Datos

La DB ya tiene schema y migrations pero necesitamos que se inicialice automáticamente.

**Archivo a crear/modificar:** `lib/db/init.ts`

```typescript
import { getDb } from './client';
import { runMigrations } from './migrations';

let initialized = false;

export async function initializeDatabase() {
  if (initialized) return;

  const db = getDb();
  runMigrations(db);
  initialized = true;

  console.log('[DB] Database initialized successfully');
}
```

**Llamar desde:** Layout principal o middleware de Next.js

---

### Paso 2: Conectar Settings Modal con API

El modal de settings necesita guardar los paths de configuración en la DB.

**Archivo:** `components/settings-modal.tsx`

**Cambios necesarios:**

1. Fetch config paths existentes al abrir:
```typescript
useEffect(() => {
  fetch('/api/config-paths')
    .then(res => res.json())
    .then(data => setConfigPaths(data.data));
}, []);
```

2. Guardar nuevos paths:
```typescript
const addConfigPath = async (appId: string, path: string) => {
  const res = await fetch('/api/config-paths', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, path })
  });
  // handle response...
};
```

---

### Paso 3: Conectar Shortcuts Table con API

La tabla actualmente muestra mock data. Necesita cargar shortcuts reales.

**Archivo:** `components/shortcuts-table.tsx` o `app/page.tsx`

**Cambios necesarios:**

1. Fetch shortcuts al cargar:
```typescript
const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch('/api/shortcuts')
    .then(res => res.json())
    .then(data => {
      setShortcuts(data.data || []);
      setLoading(false);
    });
}, []);
```

2. Refresh después de parsear configs:
```typescript
const refreshShortcuts = async () => {
  setLoading(true);
  await fetch('/api/shortcuts/refresh', { method: 'POST' });
  const res = await fetch('/api/shortcuts');
  const data = await res.json();
  setShortcuts(data.data || []);
  setLoading(false);
};
```

---

### Paso 4: Flujo Completo de Configuración

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUJO DE USUARIO                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Usuario abre Settings Modal                             │
│     └─> GET /api/config-paths (cargar paths existentes)     │
│                                                             │
│  2. Usuario agrega path de config                           │
│     └─> POST /api/config-paths                              │
│         body: { app_id: "nvim", path: "~/.config/nvim" }    │
│                                                             │
│  3. Sistema valida el path                                  │
│     └─> Verifica que existe y es accesible                  │
│     └─> Verifica que es un app_id válido                    │
│                                                             │
│  4. Usuario hace click en "Refresh" o se auto-triggerea     │
│     └─> POST /api/shortcuts/refresh                         │
│         - Lee todos los config_paths habilitados            │
│         - Ejecuta el parser correspondiente                 │
│         - Guarda shortcuts en SQLite (cache)                │
│                                                             │
│  5. UI muestra shortcuts                                    │
│     └─> GET /api/shortcuts                                  │
│         - Lee del cache (SQLite)                            │
│         - Filtrado por app_id opcional                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Paso 5: Docker Setup (para mount de volumes)

**Crear:** `Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]
```

**Crear:** `docker-compose.yml`

```yaml
services:
  awesome-shortcuts:
    build: .
    ports:
      - "3000:3000"
    volumes:
      # Configs del usuario (lectura/escritura)
      - ~/.config/nvim:/mnt/nvim:rw
      - ~/.tmux.conf:/mnt/tmux.conf:rw
      - ~/.zshrc:/mnt/zshrc:rw
      - ~/.config/Code/User/keybindings.json:/mnt/vscode/keybindings.json:rw
      # Base de datos persistente
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/data/local.db
```

**Importante:** Los paths en la app deben usar `/mnt/...` cuando corre en Docker.

---

## Tareas de Implementación

### Prioridad Alta (Bloqueantes) - COMPLETADO

- [x] **TASK-001**: Auto-run migrations en `lib/db/client.ts`
- [x] **TASK-002**: Actualizar `SettingsModal` para usar API real
- [x] **TASK-003**: Actualizar `page.tsx` para fetch shortcuts reales
- [x] **TASK-004**: Agregar botón "Refresh" que llame a `/api/shortcuts/refresh`
- [x] **TASK-005**: Manejar estados de loading y error en UI

### Prioridad Media

- [ ] **TASK-006**: Crear Dockerfile
- [ ] **TASK-007**: Crear docker-compose.yml
- [ ] **TASK-008**: Agregar detección automática de paths comunes
- [ ] **TASK-009**: Implementar file watcher para auto-refresh

### Prioridad Baja

- [ ] **TASK-010**: UI para mostrar errores de parseo
- [ ] **TASK-011**: Preview de shortcuts antes de guardar
- [ ] **TASK-012**: Indicador de "último refresh" timestamp

---

## Paths Comunes por Sistema

### macOS
```
Neovim:   ~/.config/nvim/init.lua
Tmux:     ~/.tmux.conf
Zsh:      ~/.zshrc
VS Code:  ~/Library/Application Support/Code/User/keybindings.json
```

### Linux
```
Neovim:   ~/.config/nvim/init.lua
Tmux:     ~/.tmux.conf
Zsh:      ~/.zshrc
VS Code:  ~/.config/Code/User/keybindings.json
```

---

## Testing Manual

1. Iniciar la app: `pnpm dev`
2. Abrir Settings → Config Paths
3. Agregar path: `nvim` → `~/.config/nvim`
4. Click "Refresh Shortcuts"
5. Verificar que aparecen los keybindings en la tabla

---

## Próximos Pasos

Una vez completado esto, la app podrá:

1. ✅ Leer configs del filesystem
2. ✅ Parsear shortcuts de nvim, tmux, zsh, vscode
3. ✅ Mostrarlos en una tabla filtrable
4. ⏳ Modificarlos via AI Agent (ya implementado, solo falta conectar UI)

---

*Última actualización: 2026-02-01*
