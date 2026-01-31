# Awesome Shortcuts - Project Context

## Project Vision

**Awesome Shortcuts** is a visual, minimalist, and local-first application designed to centralize, discover, and manage keyboard shortcuts and complex commands. It's not just a static reference sheet; it's an interactive environment running locally on your machine, allowing you to not only visualize but manipulate your configurations through an integrated AI Agent.

This document contains the complete architectural context and technical decisions for the project. All issues and agents should refer to this document as the single source of truth.

---

## Core Principles

1. **Local-First**: Everything runs on the user's machine. No cloud dependencies.
2. **Security by Design**: API keys and secrets never leave the local environment.
3. **Filesystem as Source of Truth**: User configs live in their standard locations (~/.config/nvim, ~/.tmux.conf, etc).
4. **AI-Augmented Workflow**: Natural language interface to modify configs surgically.
5. **Extensibility**: Community-driven parsers for new tools and applications.
6. **Minimalism**: Clean, focused UI. No bloat.

---

## Technical Stack

### Core Technologies

- **Runtime**: Node.js 20+
- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript 5+
- **Database**: SQLite (via better-sqlite3)
- **Styling**: Tailwind CSS 4+
- **Icons**: Lucide React
- **Deployment**: Docker + Docker Compose (local only)

### AI Agent Stack

- **LLM Integration**: Model-agnostic (OpenAI, Anthropic, Ollama)
- **Tools Framework**: Custom filesystem tools for reading/writing configs
- **Execution**: Server-side API routes (Next.js API handlers)

### Development Tools

- **Package Manager**: pnpm
- **Linter**: ESLint + Prettier
- **Testing**: Vitest (unit) + Playwright (e2e)
- **Type Checking**: TypeScript strict mode

---

## Architecture

### High-Level Structure

```
┌─────────────────────────────────────────┐
│         Docker Container (Local)        │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │       Next.js App (Port 3000)     │ │
│  │                                   │ │
│  │  ├─ /app (App Router)             │ │
│  │  │  ├─ page.tsx (Main UI)         │ │
│  │  │  ├─ api/                       │ │
│  │  │  │  ├─ agent/route.ts          │ │
│  │  │  │  ├─ shortcuts/route.ts      │ │
│  │  │  │  └─ config/route.ts         │ │
│  │  │                                │ │
│  │  ├─ /lib                          │ │
│  │  │  ├─ parsers/ (nvim, tmux, etc) │ │
│  │  │  ├─ agent/ (AI tools & logic)  │ │
│  │  │  └─ db/ (SQLite client)        │ │
│  │  │                                │ │
│  │  └─ /components                   │ │
│  │     ├─ shortcuts-table.tsx        │ │
│  │     ├─ ai-chat-widget.tsx         │ │
│  │     └─ settings-modal.tsx         │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │     SQLite Database (local.db)    │ │
│  │  - shortcuts (parsed cache)       │ │
│  │  - chat_history                   │ │
│  │  - config_paths                   │ │
│  │  - user_preferences               │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Bind Mounts:                          │
│  - ~/.config/nvim → /mnt/nvim          │
│  - ~/.tmux.conf → /mnt/tmux.conf       │
│  - ~/.zshrc → /mnt/zshrc               │
│  - ... (user-configurable)             │
└─────────────────────────────────────────┘
```

### Data Flow

1. **User opens app** → Next.js renders UI with cached shortcuts from SQLite
2. **User configures paths** → Settings modal saves paths to SQLite `config_paths` table
3. **App scans configs** → Parsers read mounted files, extract shortcuts, cache in SQLite
4. **User searches/filters** → Client-side filtering of cached data (instant)
5. **User asks AI to create shortcut** → Chat sends request to `/api/agent` → Agent uses filesystem tools → Writes to mounted config file → Updates SQLite cache
6. **App re-renders** → Shows new shortcut immediately

---

## Database Schema (SQLite)

```sql
-- User-configured paths to config files
CREATE TABLE config_paths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL UNIQUE, -- 'nvim', 'tmux', 'zsh', etc.
  path TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Parsed shortcuts (cache layer)
CREATE TABLE shortcuts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,
  title TEXT NOT NULL,
  keys TEXT NOT NULL, -- JSON array: ["⌘", "Shift", "P"]
  description TEXT,
  source_file TEXT NOT NULL, -- Original config file path
  source_line INTEGER, -- Line number in source file
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (app_id) REFERENCES config_paths(app_id)
);

-- AI chat history
CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User preferences
CREATE TABLE user_preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit log for AI changes
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL, -- 'create', 'update', 'delete'
  target_file TEXT NOT NULL,
  diff TEXT, -- Git-style diff
  ai_request TEXT, -- Original user request
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Supported Applications & Parsers

Each parser is a TypeScript module in `/lib/parsers/` that implements this interface:

```typescript
interface ConfigParser {
  appId: string;
  detect: (filePath: string) => boolean;
  parse: (fileContent: string) => Shortcut[];
  inject: (fileContent: string, shortcut: Shortcut) => string;
}

interface Shortcut {
  title: string;
  keys: string[];
  description?: string;
  sourceLine?: number;
}
```

### Initial Parsers (MVP)

1. **Neovim** (`parsers/neovim.ts`)
   - Supports: Vanilla Neovim, LazyVim, NvChad
   - Syntax: `vim.keymap.set()`, `map()`, `noremap`, etc.
   - Leader key detection

2. **Tmux** (`parsers/tmux.ts`)
   - Syntax: `bind-key`, `bind`, prefix combinations
   - Detects custom prefix

3. **Zsh** (`parsers/zsh.ts`)
   - Syntax: `bindkey`, `alias`
   - Plugin-aware (oh-my-zsh, prezto)

4. **VS Code** (`parsers/vscode.ts`)
   - Parses: `keybindings.json`
   - Supports: when clauses, command args

### Future Parsers (Community)

- JetBrains IDEs (Rider, WebStorm, PyCharm)
- Bash
- Emacs
- Sublime Text
- Wezterm / Alacritty

---

## AI Agent Architecture

### Agent Capabilities

The agent is a server-side component that:
1. Receives natural language requests via chat
2. Uses tools to read current config files
3. Understands the syntax of each tool (via parser modules)
4. Generates precise modifications
5. Writes changes back to mounted files
6. Updates SQLite cache
7. Returns confirmation to user

### Agent Tools

```typescript
// Available tools for the AI agent
const agentTools = [
  {
    name: "read_config",
    description: "Read a configuration file by app ID",
    parameters: { app_id: string }
  },
  {
    name: "list_shortcuts",
    description: "List current shortcuts for an app",
    parameters: { app_id: string }
  },
  {
    name: "add_shortcut",
    description: "Add a new shortcut to a config file",
    parameters: {
      app_id: string,
      shortcut: Shortcut
    }
  },
  {
    name: "remove_shortcut",
    description: "Remove a shortcut by title or keys",
    parameters: {
      app_id: string,
      identifier: string
    }
  }
];
```

### LLM Configuration

User can configure in Settings:
- Provider (OpenAI, Anthropic, Ollama)
- Model (gpt-4, claude-3-5-sonnet, llama3, etc.)
- API Key (stored in SQLite, never in code)
- Temperature, max_tokens, etc.

---

## UI Components Architecture

### Component Hierarchy

```
App (page.tsx)
├─ Sidebar
│  ├─ Logo
│  └─ CategoryNav
├─ MainContent
│  ├─ SearchBar
│  ├─ ShortcutsTable
│  │  ├─ TableHeader
│  │  └─ ShortcutRow
│  │     └─ KeyCap (visual key component)
│  └─ EmptyState
├─ AIChatWidget
│  ├─ ChatHeader
│  ├─ MessageList
│  │  └─ Message
│  └─ ChatInput
├─ SettingsModal
│  ├─ ThemeToggle
│  ├─ ConfigPathsForm
│  └─ LLMConfigForm
└─ Footer
```

### Design System

- **Colors**: Indigo primary, gray neutrals, semantic colors for states
- **Typography**: Inter font family, clear hierarchy
- **Spacing**: 4px base unit, consistent padding/margins
- **Radius**: 0.5rem standard, 1rem for modals/cards
- **Shadows**: Subtle elevation, stronger for modals
- **Animations**: Smooth transitions, micro-interactions (hover, active states)

### Accessibility

- Keyboard navigation for all interactive elements
- ARIA labels for screen readers
- Focus indicators
- Semantic HTML

---

## Docker Configuration

### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build Next.js
RUN pnpm build

# Expose port
EXPOSE 3000

# Start app
CMD ["pnpm", "start"]
```

### docker-compose.yml

```yaml
services:
  awesome-shortcuts:
    build: .
    ports:
      - "3000:3000"
    volumes:
      # User configs (read/write)
      - ~/.config/nvim:/mnt/nvim:rw
      - ~/.tmux.conf:/mnt/tmux.conf:rw
      - ~/.zshrc:/mnt/zshrc:rw
      # SQLite database (persistent)
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/data/local.db
```

---

## Development Workflow

### Project Structure

```
awesome-shortcuts/
├── app/
│   ├── page.tsx (Main UI)
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── agent/
│       │   └── route.ts
│       ├── shortcuts/
│       │   └── route.ts
│       └── config/
│           └── route.ts
├── components/
│   ├── shortcuts-table.tsx
│   ├── ai-chat-widget.tsx
│   ├── settings-modal.tsx
│   ├── key-cap.tsx
│   └── ui/ (reusable primitives)
├── lib/
│   ├── parsers/
│   │   ├── neovim.ts
│   │   ├── tmux.ts
│   │   ├── zsh.ts
│   │   └── vscode.ts
│   ├── agent/
│   │   ├── tools.ts
│   │   └── llm-client.ts
│   ├── db/
│   │   ├── client.ts
│   │   ├── migrations.ts
│   │   └── queries.ts
│   └── utils/
│       └── file-system.ts
├── tests/
│   ├── unit/
│   │   ├── parsers/
│   │   └── agent/
│   └── e2e/
│       └── shortcuts.spec.ts
├── public/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── CLAUDE.md (this file)
```

### Code Conventions

1. **TypeScript Strict Mode**: All code must pass strict type checking
2. **Functional Components**: Use React Server Components where possible
3. **Error Handling**: All async operations wrapped in try-catch, user-friendly error messages
4. **File Naming**: kebab-case for files, PascalCase for components
5. **Imports**: Absolute imports via `@/` alias
6. **Comments**: JSDoc for exported functions, inline comments for complex logic
7. **Git Commits**: Conventional commits (feat:, fix:, docs:, etc.)

### Testing Strategy

1. **Unit Tests**: All parsers, agent tools, DB queries
2. **Integration Tests**: API routes, parser + filesystem interactions
3. **E2E Tests**: Critical user flows (search, add shortcut via AI, settings)
4. **Manual Testing**: Docker build, volume mounts, multi-platform (macOS, Linux)

---

## Parallel Development Strategy

This project is designed for **highly parallel agent execution**. Tasks are divided into independent vertical slices that share minimal dependencies.

### Dependency Graph

```
Core Dependencies (must be done first):
├─ Database schema + migrations
├─ Base Next.js setup
└─ Docker configuration

Parallel Tracks (can run simultaneously):
├─ Track 1: UI Components
│   ├─ Shortcuts table
│   ├─ AI chat widget
│   └─ Settings modal
│
├─ Track 2: Parsers
│   ├─ Neovim parser
│   ├─ Tmux parser
│   ├─ Zsh parser
│   └─ VS Code parser
│
├─ Track 3: AI Agent
│   ├─ LLM client abstraction
│   ├─ Agent tools implementation
│   └─ Chat API route
│
├─ Track 4: API Routes
│   ├─ Shortcuts CRUD
│   ├─ Config paths management
│   └─ User preferences
│
└─ Track 5: Testing
    ├─ Parser unit tests
    ├─ Agent unit tests
    └─ E2E tests
```

### Issue Organization

Each issue will:
1. **Be fully self-contained**: Include all context needed to complete the task
2. **Have clear acceptance criteria**: Testable outcomes
3. **Specify dependencies**: If any (minimal by design)
4. **Include examples**: Code snippets, test cases, expected outputs
5. **Reference this document**: For shared context

---

## MVP Feature Scope

### Must-Have (v0.1)

- [ ] Basic Next.js app with Tailwind
- [ ] SQLite database with schema
- [ ] Docker setup with volume mounts
- [ ] Shortcuts table UI (read-only)
- [ ] Settings modal (config paths)
- [ ] Neovim parser (read + write)
- [ ] Tmux parser (read + write)
- [ ] AI chat widget (UI only, no LLM yet)
- [ ] Basic search/filter functionality

### Should-Have (v0.2)

- [ ] AI agent with OpenAI integration
- [ ] Agent tools (read_config, add_shortcut)
- [ ] Zsh parser
- [ ] VS Code parser
- [ ] Dark/light theme persistence
- [ ] Audit log for AI changes
- [ ] Error boundaries and user feedback

### Nice-to-Have (v0.3+)

- [ ] Multi-LLM support (Anthropic, Ollama)
- [ ] Shortcut conflict detection
- [ ] Export shortcuts to Markdown/PDF
- [ ] Community parser contributions (GitHub PRs)
- [ ] Keyboard-only navigation mode
- [ ] Shortcut usage analytics

---

## Open Source Strategy

### Repository

- **License**: MIT
- **Platform**: GitHub
- **Visibility**: Public from day one
- **Contributing Guide**: CONTRIBUTING.md with parser template
- **Issue Templates**: Bug report, feature request, new parser proposal

### Community Extensibility

Parsers are designed to be community-contributed. Template:

```typescript
// lib/parsers/new-tool.ts
import type { ConfigParser, Shortcut } from '@/lib/types';

export const newToolParser: ConfigParser = {
  appId: 'new-tool',

  detect: (filePath: string) => {
    // How to detect if this file is for your tool
    return filePath.endsWith('.newtoolrc');
  },

  parse: (fileContent: string) => {
    // Parse shortcuts from file content
    const shortcuts: Shortcut[] = [];
    // ... parsing logic
    return shortcuts;
  },

  inject: (fileContent: string, shortcut: Shortcut) => {
    // Add new shortcut to file content
    // Return modified content
    return fileContent + `\n# New shortcut\n...`;
  }
};
```

---

## Performance Targets

- **Initial Load**: < 1s (with cached shortcuts)
- **Search/Filter**: < 100ms (client-side)
- **AI Response**: < 5s (depends on LLM)
- **Config File Parse**: < 500ms per file
- **Docker Build**: < 2min

---

## Security Considerations

1. **No Network Exposure**: App only accessible on localhost
2. **Secrets in SQLite**: Encrypted at rest (user responsibility for disk encryption)
3. **File Access**: Limited to mounted volumes only
4. **No Telemetry**: Zero data leaves the machine
5. **Dependency Scanning**: Regular `pnpm audit`

---

## Success Metrics

1. **Functional**: All parsers correctly read/write to their config files
2. **Usability**: User can add a shortcut via AI in < 30 seconds
3. **Reliability**: Docker container starts successfully on macOS & Linux
4. **Extensibility**: Community can add new parser in < 2 hours
5. **Performance**: Meets all performance targets above

---

## References

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [SQLite Better-Sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev)
- [Docker Volumes](https://docs.docker.com/storage/volumes/)

---

**Last Updated**: 2026-01-31
**Version**: 1.0.0
**Maintainer**: @pablitxn
