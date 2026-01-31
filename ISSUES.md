# Awesome Shortcuts - Development Issues

This document contains all planned development issues organized by parallel execution tracks. Each issue is designed to be executed by an autonomous agent.

**Context Document**: See [CLAUDE.md](./CLAUDE.md) for complete architectural context.

---

## Issue Dependency Graph

```
TRACK 0 (Core - Sequential)
├─ #001: Project Setup & Database Schema
├─ #002: Docker Configuration & Volume Mounts
└─ #003: Next.js Base Structure & Tailwind Setup

TRACK 1 (UI Components - Parallel after Track 0)
├─ #101: Shortcuts Table Component
├─ #102: AI Chat Widget Component
├─ #103: Settings Modal Component
└─ #104: Reusable UI Primitives (KeyCap, Buttons, Inputs)

TRACK 2 (Parsers - Fully Parallel after Track 0)
├─ #201: Neovim Config Parser
├─ #202: Tmux Config Parser
├─ #203: Zsh Config Parser
└─ #204: VS Code Keybindings Parser

TRACK 3 (AI Agent - Parallel after Track 0)
├─ #301: LLM Client Abstraction
├─ #302: Agent Tools Implementation
└─ #303: Agent Chat API Route

TRACK 4 (API Routes - Parallel after Track 0)
├─ #401: Shortcuts CRUD API
├─ #402: Config Paths Management API
└─ #403: User Preferences API

TRACK 5 (Testing - Parallel after each feature)
├─ #501: Parser Unit Tests
├─ #502: Agent Integration Tests
└─ #503: E2E User Flow Tests
```

---

## TRACK 0: Core Infrastructure (Sequential)

These must be completed first as they are dependencies for all other tracks.

### #001: Project Setup & Database Schema

**Priority**: P0 (Blocker)
**Estimated Complexity**: Large
**Dependencies**: None
**Assignable to**: Agent

**Description**:
Set up the foundational Next.js project structure with TypeScript, pnpm, and SQLite database with complete schema implementation.

**Acceptance Criteria**:
- [ ] Next.js 15+ project initialized with App Router
- [ ] pnpm configured as package manager
- [ ] TypeScript strict mode enabled
- [ ] SQLite database initialized with schema from CLAUDE.md
- [ ] Database migration system in place
- [ ] Database client utility created (`lib/db/client.ts`)
- [ ] All tables created: `config_paths`, `shortcuts`, `chat_messages`, `user_preferences`, `audit_log`
- [ ] Seed data script for development

**Implementation Details**:

```bash
# Initialize project
pnpm create next-app@latest awesome-shortcuts --typescript --tailwind --app --no-src-dir
cd awesome-shortcuts

# Install dependencies
pnpm add better-sqlite3
pnpm add -D @types/better-sqlite3
```

Create `lib/db/client.ts`:
```typescript
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'local.db');
export const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

export default db;
```

Create `lib/db/migrations.ts`:
```typescript
import db from './client';

export function runMigrations() {
  // Create tables as defined in CLAUDE.md schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS config_paths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id TEXT NOT NULL UNIQUE,
      path TEXT NOT NULL,
      enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shortcuts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id TEXT NOT NULL,
      title TEXT NOT NULL,
      keys TEXT NOT NULL,
      description TEXT,
      source_file TEXT NOT NULL,
      source_line INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (app_id) REFERENCES config_paths(app_id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      target_file TEXT NOT NULL,
      diff TEXT,
      ai_request TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
```

Create `lib/db/queries.ts` with type-safe query helpers.

**Testing**:
- Verify database file created at correct path
- Verify all tables exist with correct schema
- Insert and query test data
- Verify foreign key constraints work

**Files to Create**:
- `lib/db/client.ts`
- `lib/db/migrations.ts`
- `lib/db/queries.ts`
- `lib/types/index.ts` (shared types)
- `scripts/seed.ts`

---

### #002: Docker Configuration & Volume Mounts

**Priority**: P0 (Blocker)
**Estimated Complexity**: Large
**Dependencies**: #001
**Assignable to**: Agent

**Description**:
Create production-ready Docker configuration with proper volume mounting for user config files and persistent SQLite database.

**Acceptance Criteria**:
- [ ] `Dockerfile` created with multi-stage build
- [ ] `docker-compose.yml` with volume mounts
- [ ] `.dockerignore` configured
- [ ] Health check endpoint implemented
- [ ] Environment variables documented
- [ ] README with Docker usage instructions
- [ ] Successfully builds and runs on macOS
- [ ] Config files accessible from container

**Implementation Details**:

Create `Dockerfile`:
```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install pnpm in builder
RUN npm install -g pnpm

# Build Next.js
RUN pnpm build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create data directory for SQLite
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]
```

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    volumes:
      # Config files (read/write)
      - ${HOME}/.config/nvim:/mnt/nvim:rw
      - ${HOME}/.tmux.conf:/mnt/tmux.conf:rw
      - ${HOME}/.zshrc:/mnt/zshrc:rw
      # SQLite persistence
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/data/local.db
      - CONFIG_NVIM_PATH=/mnt/nvim
      - CONFIG_TMUX_PATH=/mnt/tmux.conf
      - CONFIG_ZSH_PATH=/mnt/zshrc
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

Create `app/api/health/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import db from '@/lib/db/client';

export async function GET() {
  try {
    // Check DB connection
    db.prepare('SELECT 1').get();

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message
    }, { status: 500 });
  }
}
```

**Testing**:
- `docker-compose build` succeeds
- `docker-compose up` starts app on port 3000
- Health check endpoint returns 200
- Volume mounts work (can read mounted files from container)
- Database persists between container restarts

**Files to Create**:
- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `app/api/health/route.ts`
- `README.md` (Docker section)

---

### #003: Next.js Base Structure & Tailwind Setup

**Priority**: P0 (Blocker)
**Estimated Complexity**: Large
**Dependencies**: #001
**Assignable to**: Agent

**Description**:
Set up the Next.js application structure with Tailwind CSS, design system tokens, and base layout components.

**Acceptance Criteria**:
- [ ] App Router structure created
- [ ] Tailwind configured with design tokens from CLAUDE.md
- [ ] Root layout with theme provider
- [ ] Base CSS variables for colors
- [ ] Typography system set up
- [ ] Lucide icons installed
- [ ] Main page layout (sidebar + content)
- [ ] Dark/light theme toggle working

**Implementation Details**:

Update `tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
      },
      borderRadius: {
        lg: '0.5rem',
        xl: '1rem',
      },
    },
  },
  plugins: [],
};

export default config;
```

Create `app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --border: 214.3 31.8% 91.4%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
  }
}
```

Create `app/layout.tsx`:
```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Awesome Shortcuts',
  description: 'AI-Powered Local Keyboard Command Center',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Create basic `app/page.tsx`:
```typescript
export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <h1 className="text-4xl font-bold">Awesome Shortcuts</h1>
      <p>Loading...</p>
    </div>
  );
}
```

**Dependencies to Install**:
```bash
pnpm add lucide-react next-themes
```

**Testing**:
- Page renders without errors
- Dark/light theme toggle works
- Tailwind classes apply correctly
- Custom CSS variables work

**Files to Create**:
- `app/layout.tsx`
- `app/page.tsx`
- `app/globals.css`
- `tailwind.config.ts`
- `components/theme-provider.tsx`

---

## TRACK 1: UI Components (Parallel)

These can all be developed in parallel after Track 0 completes.

### #101: Shortcuts Table Component

**Priority**: P1
**Estimated Complexity**: Large
**Dependencies**: #003
**Assignable to**: Agent
**Parallel with**: #102, #103, #104

**Description**:
Implement the main shortcuts table component with search, filtering, and visual key representations. This is the core UI of the application.

**Acceptance Criteria**:
- [ ] `ShortcutsTable` component renders shortcuts from props
- [ ] `KeyCap` component displays individual keys with 3D effect
- [ ] Search/filter functionality (client-side)
- [ ] Category filtering (sidebar navigation)
- [ ] Responsive design (mobile/tablet/desktop)
- [ ] Empty state when no shortcuts found
- [ ] Hover effects and animations
- [ ] Accessible keyboard navigation

**Component API**:

```typescript
interface Shortcut {
  id: number;
  title: string;
  keys: string[];
  category: string;
  description?: string;
}

interface ShortcutsTableProps {
  shortcuts: Shortcut[];
  selectedCategory: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}
```

**Implementation Details**:

Create `components/shortcuts-table.tsx`:
```typescript
'use client';

import { KeyCap } from './key-cap';
import { Search } from 'lucide-react';

interface Shortcut {
  id: number;
  title: string;
  keys: string[];
  category: string;
  description?: string;
}

interface ShortcutsTableProps {
  shortcuts: Shortcut[];
  selectedCategory: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function ShortcutsTable({
  shortcuts,
  selectedCategory,
  searchQuery,
  onSearchChange,
}: ShortcutsTableProps) {
  const filteredShortcuts = shortcuts.filter((shortcut) => {
    const matchesSearch =
      shortcut.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shortcut.keys.join(' ').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = shortcut.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex-1 min-w-0">
      {/* Search Bar */}
      <div className="relative mb-10 group max-w-2xl">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-primary" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-4 py-3 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm font-medium"
          placeholder={`Filter shortcuts...`}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden border border-border bg-card">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-6 py-3 font-semibold w-1/4">Shortcut</th>
              <th className="px-6 py-3 font-semibold w-1/4">Keys</th>
              <th className="px-6 py-3 font-semibold w-1/3">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filteredShortcuts.map((shortcut) => (
              <tr
                key={shortcut.id}
                className="group hover:bg-accent/50 transition-colors"
              >
                <td className="px-6 py-4">
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {shortcut.title}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {shortcut.keys.map((key, idx) => (
                      <React.Fragment key={idx}>
                        <KeyCap label={key} small />
                        {idx < shortcut.keys.length - 1 && (
                          <span className="self-center text-[10px] font-bold text-muted-foreground">
                            +
                          </span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-muted-foreground">
                    {shortcut.description}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredShortcuts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No shortcuts found</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

Create `components/key-cap.tsx`:
```typescript
interface KeyCapProps {
  label: string;
  small?: boolean;
}

export function KeyCap({ label, small = false }: KeyCapProps) {
  // Convert modifier names to symbols
  const displayLabel =
    label === 'Option'
      ? '⌥'
      : label === 'Shift'
      ? '⇧'
      : label === 'Control' || label === 'Ctrl'
      ? '⌃'
      : label;

  const isSymbol = ['⌘', '⌥', '⇧', '⌃'].includes(displayLabel);

  return (
    <div
      className={`
        relative group flex items-center justify-center
        rounded-md border-b-[3px] border-border
        font-mono font-bold shadow-sm
        bg-card text-foreground
        transform active:border-b-0 active:translate-y-[2px]
        transition-all duration-150 select-none
        ${small ? 'min-w-[28px] h-7 px-1.5 text-xs' : 'min-w-[40px] h-10 px-3 text-sm'}
      `}
    >
      <span className={isSymbol ? (small ? 'text-sm leading-none' : 'text-lg leading-none') : ''}>
        {displayLabel}
      </span>
    </div>
  );
}
```

**Testing**:
- Render with mock data (20+ shortcuts)
- Search filters correctly
- Category filter works
- Empty state displays when no results
- Keyboard navigation works (tab through rows)
- Responsive on mobile (320px width)

**Files to Create**:
- `components/shortcuts-table.tsx`
- `components/key-cap.tsx`

---

### #102: AI Chat Widget Component

**Priority**: P1
**Estimated Complexity**: Large
**Dependencies**: #003
**Assignable to**: Agent
**Parallel with**: #101, #103, #104

**Description**:
Build the floating AI chat widget component that allows users to interact with the shortcut agent. UI only for now, AI integration happens in Track 3.

**Acceptance Criteria**:
- [ ] Floating chat button (bottom-right)
- [ ] Expandable chat window
- [ ] Message list with scroll
- [ ] User/bot message differentiation
- [ ] Input field with send button
- [ ] Typing indicator animation
- [ ] Auto-scroll to latest message
- [ ] Close/minimize functionality
- [ ] Smooth animations (slide in/out)

**Component API**:

```typescript
interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  messages: Message[];
  onSendMessage: (content: string) => void;
  isTyping?: boolean;
}
```

**Implementation Details**:

Create `components/ai-chat-widget.tsx`:
```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send } from 'lucide-react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  messages: Message[];
  onSendMessage: (content: string) => void;
  isTyping?: boolean;
}

export function AIChatWidget({
  isOpen,
  onToggle,
  messages,
  onSendMessage,
  isTyping = false,
}: AIChatWidgetProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-20 right-8 w-12 h-12 bg-primary hover:bg-primary/90 rounded-full flex items-center justify-center shadow-lg shadow-primary/30 transition-all hover:scale-110 z-40 group"
      >
        <Sparkles className="text-primary-foreground w-5 h-5 group-hover:rotate-12 transition-transform" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-8 w-80 md:w-96 h-[450px] border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden z-40 bg-card animate-in slide-in-from-bottom-10 fade-in duration-300">
      {/* Header */}
      <div className="p-4 border-b border-border flex justify-between items-center bg-accent">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="font-semibold text-foreground">Shortcut Agent</span>
        </div>
        <button
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-background"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`
                max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm
                ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-none'
                    : 'bg-accent text-foreground rounded-bl-none'
                }
              `}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="p-3 rounded-2xl rounded-bl-none flex gap-1 bg-accent">
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100"></span>
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border bg-accent">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me to create a shortcut..."
            className="w-full pl-4 pr-10 py-3 rounded-xl border border-border bg-background text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm"
          />
          <button
            onClick={handleSend}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary hover:bg-primary/90 rounded-lg text-primary-foreground transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Testing**:
- Chat opens/closes smoothly
- Messages render correctly (user vs assistant)
- Typing indicator shows when active
- Input field works (type + enter)
- Auto-scroll to bottom on new messages
- Responsive on mobile

**Files to Create**:
- `components/ai-chat-widget.tsx`

---

### #103: Settings Modal Component

**Priority**: P1
**Estimated Complexity**: Large
**Dependencies**: #003
**Assignable to**: Agent
**Parallel with**: #101, #102, #104

**Description**:
Create the settings modal where users configure config file paths, theme preferences, and LLM settings.

**Acceptance Criteria**:
- [ ] Modal overlay with backdrop blur
- [ ] Theme toggle (dark/light)
- [ ] Config paths form (nvim, tmux, zsh, vscode)
- [ ] File browser button (placeholder for now)
- [ ] LLM configuration section
- [ ] Save button with confirmation
- [ ] Close/cancel functionality
- [ ] Form validation
- [ ] Keyboard shortcuts (Esc to close)

**Component API**:

```typescript
interface ConfigPath {
  appId: string;
  path: string;
  enabled: boolean;
}

interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'ollama';
  model: string;
  apiKey: string;
  temperature?: number;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  configPaths: ConfigPath[];
  onSaveConfigPaths: (paths: ConfigPath[]) => void;
  llmConfig: LLMConfig;
  onSaveLLMConfig: (config: LLMConfig) => void;
}
```

**Implementation Details**:

Create `components/settings-modal.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { X, Moon, Sun, FileCode, FolderOpen, Save } from 'lucide-react';

interface ConfigPath {
  appId: string;
  path: string;
  enabled: boolean;
}

interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'ollama';
  model: string;
  apiKey: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  configPaths: ConfigPath[];
  onSaveConfigPaths: (paths: ConfigPath[]) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  configPaths,
  onSaveConfigPaths,
  isDark,
  onToggleTheme,
}: SettingsModalProps) {
  const [paths, setPaths] = useState(configPaths);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveConfigPaths(paths);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-foreground">Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Customize your experience and data sources
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-8">
          {/* Theme Section */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-4 text-muted-foreground">
              Appearance
            </h3>
            <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-accent/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {isDark ? <Moon size={20} /> : <Sun size={20} />}
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {isDark ? 'Dark' : 'Light'} Mode
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Toggle the visual theme
                  </p>
                </div>
              </div>
              <button
                onClick={onToggleTheme}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${isDark ? 'bg-primary' : 'bg-muted'}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-background transition-transform
                    ${isDark ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>
          </div>

          {/* Config Paths Section */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-4 text-muted-foreground">
              Configuration Files
            </h3>
            <div className="space-y-4">
              {paths.map((config) => (
                <div key={config.appId} className="group">
                  <label className="block text-xs font-medium mb-1.5 ml-1 text-foreground">
                    {config.appId.toUpperCase()} Path
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FileCode size={14} className="text-muted-foreground" />
                      </div>
                      <input
                        type="text"
                        value={config.path}
                        onChange={(e) => {
                          setPaths(
                            paths.map((p) =>
                              p.appId === config.appId
                                ? { ...p, path: e.target.value }
                                : p
                            )
                          );
                        }}
                        placeholder={`/path/to/${config.appId}/config`}
                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-xs font-mono"
                      />
                    </div>
                    <button className="px-3 py-2 rounded-lg border border-border font-medium text-xs hover:bg-accent transition-colors flex items-center gap-2 text-foreground">
                      <FolderOpen size={14} />
                      Browse
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-accent flex justify-end gap-3">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium shadow-lg shadow-primary/20 flex items-center gap-2 transition-all active:scale-95"
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Testing**:
- Modal opens/closes correctly
- Theme toggle persists
- Config paths can be edited
- Save button triggers callback
- ESC key closes modal
- Click outside closes modal

**Files to Create**:
- `components/settings-modal.tsx`

---

### #104: Reusable UI Primitives (KeyCap, Buttons, Inputs)

**Priority**: P2
**Estimated Complexity**: Medium
**Dependencies**: #003
**Assignable to**: Agent
**Parallel with**: #101, #102, #103

**Description**:
Create a library of reusable UI primitives that can be used across all components for consistency.

**Acceptance Criteria**:
- [ ] `KeyCap` component (already in #101, extract here)
- [ ] `Button` component with variants
- [ ] `Input` component with variants
- [ ] `Select` component
- [ ] `Badge` component
- [ ] `Card` component
- [ ] Storybook or component playground
- [ ] Full TypeScript types

**Files to Create**:
- `components/ui/button.tsx`
- `components/ui/input.tsx`
- `components/ui/select.tsx`
- `components/ui/badge.tsx`
- `components/ui/card.tsx`

---

## TRACK 2: Parsers (Fully Parallel)

All parsers can be developed simultaneously with no dependencies on each other.

### #201: Neovim Config Parser

**Priority**: P1
**Estimated Complexity**: Large
**Dependencies**: #001
**Assignable to**: Agent
**Parallel with**: #202, #203, #204

**Description**:
Implement a parser for Neovim configuration files (Lua and VimScript) that can extract keyboard shortcuts and inject new ones.

**Context**:
Neovim configs use various syntaxes:
- Lua: `vim.keymap.set('n', '<leader>ff', ':Telescope find_files<CR>', { desc = 'Find Files' })`
- VimScript: `nnoremap <leader>w :w<CR>`
- LazyVim style: `keys = { { '<leader>e', '<cmd>Oil<CR>', desc = 'File Explorer' } }`

**Acceptance Criteria**:
- [ ] Detects if file is Neovim config (init.lua, init.vim, *.vim, *.lua in nvim dir)
- [ ] Parses Lua `vim.keymap.set()` calls
- [ ] Parses VimScript `nnoremap`, `noremap`, `map` commands
- [ ] Detects leader key (default `\`, custom `<Space>`, etc.)
- [ ] Extracts: mode, keys, command, description
- [ ] Injects new shortcuts in correct format
- [ ] Preserves formatting and comments
- [ ] Unit tests with real config examples

**Parser Interface**:

```typescript
export interface ConfigParser {
  appId: string;
  detect: (filePath: string, content?: string) => boolean;
  parse: (fileContent: string) => Shortcut[];
  inject: (fileContent: string, shortcut: Shortcut) => string;
}

export interface Shortcut {
  title: string;
  keys: string[];
  description?: string;
  sourceLine?: number;
}
```

**Implementation Details**:

Create `lib/parsers/neovim.ts`:
```typescript
import type { ConfigParser, Shortcut } from '@/lib/types';

export const neovimParser: ConfigParser = {
  appId: 'nvim',

  detect: (filePath: string, content?: string) => {
    // Check file path
    if (
      filePath.includes('nvim') &&
      (filePath.endsWith('.lua') || filePath.endsWith('.vim') || filePath.endsWith('init.lua') || filePath.endsWith('init.vim'))
    ) {
      return true;
    }
    return false;
  },

  parse: (fileContent: string) => {
    const shortcuts: Shortcut[] = [];
    const lines = fileContent.split('\n');

    lines.forEach((line, index) => {
      // Parse Lua vim.keymap.set
      const luaMatch = line.match(
        /vim\.keymap\.set\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"],\s*['"]([^'"]+)['"]/
      );
      if (luaMatch) {
        const [_, mode, keys, command] = luaMatch;

        // Extract description if present
        const descMatch = line.match(/desc\s*=\s*['"]([^'"]+)['"]/);
        const description = descMatch ? descMatch[1] : undefined;

        shortcuts.push({
          title: description || command.substring(0, 30),
          keys: parseKeys(keys),
          description: description || command,
          sourceLine: index + 1,
        });
      }

      // Parse VimScript noremap
      const vimMatch = line.match(/n?n?oremap\s+([^\s]+)\s+(.+)/);
      if (vimMatch) {
        const [_, keys, command] = vimMatch;
        shortcuts.push({
          title: command.substring(0, 30),
          keys: parseKeys(keys),
          description: command,
          sourceLine: index + 1,
        });
      }
    });

    return shortcuts;
  },

  inject: (fileContent: string, shortcut: Shortcut) => {
    // Find a good place to inject (after last keymap or at end)
    const lines = fileContent.split('\n');
    let insertIndex = lines.length;

    // Find last keymap line
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes('vim.keymap.set') || lines[i].includes('noremap')) {
        insertIndex = i + 1;
        break;
      }
    }

    // Generate new keymap line
    const keysStr = shortcut.keys.join('');
    const newLine = `vim.keymap.set('n', '${keysStr}', ':${shortcut.description}<CR>', { desc = '${shortcut.title}' })`;

    lines.splice(insertIndex, 0, newLine);
    return lines.join('\n');
  },
};

function parseKeys(keyStr: string): string[] {
  // Convert vim key notation to display format
  // <leader>ff -> ["Leader", "f", "f"]
  // <C-w> -> ["Ctrl", "w"]
  const keys: string[] = [];

  let current = keyStr;

  // Replace leader
  if (current.includes('<leader>')) {
    keys.push('Leader');
    current = current.replace('<leader>', '');
  }

  // Replace modifiers
  if (current.includes('<C-')) {
    keys.push('Ctrl');
    current = current.replace(/<C-([^>]+)>/, '$1');
  }
  if (current.includes('<M-')) {
    keys.push('Alt');
    current = current.replace(/<M-([^>]+)>/, '$1');
  }
  if (current.includes('<S-')) {
    keys.push('Shift');
    current = current.replace(/<S-([^>]+)>/, '$1');
  }

  // Split remaining characters
  for (const char of current) {
    if (char !== '<' && char !== '>') {
      keys.push(char);
    }
  }

  return keys;
}
```

**Test Cases**:

Create `tests/unit/parsers/neovim.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { neovimParser } from '@/lib/parsers/neovim';

describe('Neovim Parser', () => {
  it('should detect neovim config files', () => {
    expect(neovimParser.detect('/home/user/.config/nvim/init.lua')).toBe(true);
    expect(neovimParser.detect('/home/user/.vimrc')).toBe(false);
  });

  it('should parse lua keymap.set', () => {
    const config = `
      vim.keymap.set('n', '<leader>ff', ':Telescope find_files<CR>', { desc = 'Find Files' })
      vim.keymap.set('n', '<C-w>', ':close<CR>', { desc = 'Close Window' })
    `;

    const shortcuts = neovimParser.parse(config);

    expect(shortcuts).toHaveLength(2);
    expect(shortcuts[0].title).toBe('Find Files');
    expect(shortcuts[0].keys).toEqual(['Leader', 'f', 'f']);
  });

  it('should inject new shortcut', () => {
    const config = `vim.keymap.set('n', '<leader>w', ':w<CR>', { desc = 'Save' })`;

    const result = neovimParser.inject(config, {
      title: 'Quit',
      keys: ['Leader', 'q'],
      description: 'quit',
    });

    expect(result).toContain("vim.keymap.set('n', '<leader>q', ':quit<CR>'");
  });
});
```

**Testing**:
- All unit tests pass
- Tested with real LazyVim config
- Tested with vanilla Neovim config
- Edge cases (multiline, comments, strings with quotes)

**Files to Create**:
- `lib/parsers/neovim.ts`
- `tests/unit/parsers/neovim.test.ts`

---

### #202: Tmux Config Parser

**Priority**: P1
**Estimated Complexity**: Large
**Dependencies**: #001
**Assignable to**: Agent
**Parallel with**: #201, #203, #204

**Description**:
Implement a parser for Tmux configuration files (.tmux.conf) that understands bind-key syntax and prefix combinations.

**Context**:
Tmux uses:
- `bind-key -n M-h select-pane -L` (no prefix)
- `bind C-a send-prefix` (prefix key)
- `bind % split-window -h` (with prefix)

**Acceptance Criteria**:
- [ ] Detects .tmux.conf files
- [ ] Parses `bind-key`, `bind` commands
- [ ] Detects custom prefix (default Ctrl+B)
- [ ] Distinguishes prefix vs no-prefix bindings
- [ ] Extracts description from comments
- [ ] Injects new bindings correctly
- [ ] Preserves formatting
- [ ] Unit tests

**Files to Create**:
- `lib/parsers/tmux.ts`
- `tests/unit/parsers/tmux.test.ts`

---

### #203: Zsh Config Parser

**Priority**: P1
**Estimated Complexity**: Large
**Dependencies**: #001
**Assignable to**: Agent
**Parallel with**: #201, #202, #204

**Description**:
Implement a parser for Zsh configuration files (.zshrc) focusing on bindkey and alias commands.

**Context**:
Zsh uses:
- `bindkey '^R' history-incremental-search-backward`
- `alias gs='git status'`
- Plugin bindings (oh-my-zsh, prezto)

**Acceptance Criteria**:
- [ ] Detects .zshrc, .zsh_aliases files
- [ ] Parses `bindkey` commands
- [ ] Parses `alias` commands
- [ ] Converts control sequences to readable format
- [ ] Injects new bindings
- [ ] Unit tests

**Files to Create**:
- `lib/parsers/zsh.ts`
- `tests/unit/parsers/zsh.test.ts`

---

### #204: VS Code Keybindings Parser

**Priority**: P2
**Estimated Complexity**: Medium
**Dependencies**: #001
**Assignable to**: Agent
**Parallel with**: #201, #202, #203

**Description**:
Implement a parser for VS Code keybindings.json files.

**Context**:
VS Code uses JSON:
```json
{
  "key": "ctrl+shift+p",
  "command": "workbench.action.showCommands",
  "when": "editorTextFocus"
}
```

**Acceptance Criteria**:
- [ ] Detects keybindings.json
- [ ] Parses JSON format
- [ ] Handles `when` clauses
- [ ] Handles command args
- [ ] Injects new bindings
- [ ] Validates JSON structure
- [ ] Unit tests

**Files to Create**:
- `lib/parsers/vscode.ts`
- `tests/unit/parsers/vscode.test.ts`

---

## TRACK 3: AI Agent (Parallel)

### #301: LLM Client Abstraction

**Priority**: P1
**Estimated Complexity**: Large
**Dependencies**: #001
**Assignable to**: Agent
**Parallel with**: All Track 4

**Description**:
Create a model-agnostic LLM client that supports OpenAI, Anthropic, and Ollama with a unified interface.

**Acceptance Criteria**:
- [ ] Unified `LLMClient` interface
- [ ] OpenAI provider implementation
- [ ] Anthropic provider implementation
- [ ] Ollama provider implementation
- [ ] Streaming support
- [ ] Error handling
- [ ] Rate limiting
- [ ] Configuration from database
- [ ] Unit tests with mocks

**Implementation Details**:

Create `lib/agent/llm-client.ts`:
```typescript
export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'ollama';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export abstract class LLMClient {
  abstract chat(messages: LLMMessage[], tools?: any[]): Promise<LLMResponse>;
  abstract stream(messages: LLMMessage[]): AsyncIterable<string>;
}

export class OpenAIClient extends LLMClient {
  // Implementation
}

export class AnthropicClient extends LLMClient {
  // Implementation
}

export class OllamaClient extends LLMClient {
  // Implementation
}

export function createLLMClient(config: LLMConfig): LLMClient {
  switch (config.provider) {
    case 'openai':
      return new OpenAIClient(config);
    case 'anthropic':
      return new AnthropicClient(config);
    case 'ollama':
      return new OllamaClient(config);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
```

**Dependencies to Install**:
```bash
pnpm add openai @anthropic-ai/sdk
```

**Testing**:
- Mock API responses
- Test each provider separately
- Test error cases (invalid key, rate limits)

**Files to Create**:
- `lib/agent/llm-client.ts`
- `lib/agent/providers/openai.ts`
- `lib/agent/providers/anthropic.ts`
- `lib/agent/providers/ollama.ts`
- `tests/unit/agent/llm-client.test.ts`

---

### #302: Agent Tools Implementation

**Priority**: P1
**Estimated Complexity**: Large
**Dependencies**: #001, #201, #202, #203, #204 (at least one parser)
**Assignable to**: Agent
**Parallel with**: #301, Track 4

**Description**:
Implement the tools that the AI agent can use to read and modify config files.

**Acceptance Criteria**:
- [ ] `read_config` tool
- [ ] `list_shortcuts` tool
- [ ] `add_shortcut` tool
- [ ] `remove_shortcut` tool
- [ ] Tool execution framework
- [ ] Error handling
- [ ] Audit logging
- [ ] Unit tests

**Implementation Details**:

Create `lib/agent/tools.ts`:
```typescript
import db from '@/lib/db/client';
import { parsers } from '@/lib/parsers';
import fs from 'fs/promises';

export interface Tool {
  name: string;
  description: string;
  parameters: any;
  execute: (params: any) => Promise<any>;
}

export const tools: Tool[] = [
  {
    name: 'read_config',
    description: 'Read a configuration file by app ID',
    parameters: {
      type: 'object',
      properties: {
        app_id: { type: 'string', description: 'App ID (nvim, tmux, zsh, vscode)' },
      },
      required: ['app_id'],
    },
    execute: async ({ app_id }) => {
      // Get path from database
      const config = db.prepare('SELECT path FROM config_paths WHERE app_id = ? AND enabled = 1').get(app_id);
      if (!config) {
        throw new Error(`No config found for app: ${app_id}`);
      }

      // Read file
      const content = await fs.readFile(config.path, 'utf-8');

      // Parse shortcuts
      const parser = parsers.find(p => p.appId === app_id);
      const shortcuts = parser ? parser.parse(content) : [];

      return {
        path: config.path,
        content: content.substring(0, 500), // Truncate for LLM context
        shortcutsCount: shortcuts.length,
        shortcuts: shortcuts.slice(0, 10), // First 10 for context
      };
    },
  },

  {
    name: 'add_shortcut',
    description: 'Add a new shortcut to a config file',
    parameters: {
      type: 'object',
      properties: {
        app_id: { type: 'string' },
        title: { type: 'string' },
        keys: { type: 'array', items: { type: 'string' } },
        description: { type: 'string' },
      },
      required: ['app_id', 'title', 'keys'],
    },
    execute: async ({ app_id, title, keys, description }) => {
      const config = db.prepare('SELECT path FROM config_paths WHERE app_id = ? AND enabled = 1').get(app_id);
      if (!config) {
        throw new Error(`No config found for app: ${app_id}`);
      }

      const parser = parsers.find(p => p.appId === app_id);
      if (!parser) {
        throw new Error(`No parser for app: ${app_id}`);
      }

      // Read current content
      const content = await fs.readFile(config.path, 'utf-8');

      // Inject shortcut
      const newContent = parser.inject(content, { title, keys, description });

      // Write back
      await fs.writeFile(config.path, newContent, 'utf-8');

      // Audit log
      db.prepare(`
        INSERT INTO audit_log (action, target_file, diff, ai_request)
        VALUES (?, ?, ?, ?)
      `).run('create', config.path, `Added: ${title}`, JSON.stringify({ title, keys, description }));

      // Update cache
      const parsedShortcuts = parser.parse(newContent);
      // ... update shortcuts table

      return {
        success: true,
        message: `Added shortcut "${title}" to ${app_id}`,
      };
    },
  },

  // ... other tools
];

export function executeTool(toolName: string, params: any) {
  const tool = tools.find(t => t.name === toolName);
  if (!tool) {
    throw new Error(`Tool not found: ${toolName}`);
  }
  return tool.execute(params);
}
```

**Testing**:
- Mock filesystem operations
- Test each tool in isolation
- Test error cases (file not found, parse errors)

**Files to Create**:
- `lib/agent/tools.ts`
- `tests/unit/agent/tools.test.ts`

---

### #303: Agent Chat API Route

**Priority**: P1
**Estimated Complexity**: Large
**Dependencies**: #301, #302
**Assignable to**: Agent

**Description**:
Implement the `/api/agent` route that handles chat messages, executes tools, and returns responses.

**Acceptance Criteria**:
- [ ] POST /api/agent endpoint
- [ ] Accepts user message
- [ ] Loads chat history from database
- [ ] Calls LLM with tools
- [ ] Executes tool calls
- [ ] Saves chat history
- [ ] Returns assistant response
- [ ] Error handling
- [ ] Streaming support (optional)

**Implementation Details**:

Create `app/api/agent/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/client';
import { createLLMClient } from '@/lib/agent/llm-client';
import { tools, executeTool } from '@/lib/agent/tools';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    const session = sessionId || uuidv4();

    // Save user message
    db.prepare(`
      INSERT INTO chat_messages (session_id, role, content)
      VALUES (?, ?, ?)
    `).run(session, 'user', message);

    // Load chat history
    const history = db.prepare(`
      SELECT role, content FROM chat_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
    `).all(session);

    // Get LLM config
    const llmConfigRow = db.prepare(`SELECT value FROM user_preferences WHERE key = 'llm_config'`).get();
    const llmConfig = llmConfigRow ? JSON.parse(llmConfigRow.value) : {
      provider: 'openai',
      model: 'gpt-4',
      apiKey: process.env.OPENAI_API_KEY,
    };

    const llm = createLLMClient(llmConfig);

    // Add system message
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant that helps users manage keyboard shortcuts. You can read config files, list shortcuts, and add new ones.',
      },
      ...history,
    ];

    // Call LLM with tools
    const response = await llm.chat(messages, tools);

    // If LLM wants to use tools, execute them
    // (This is simplified - real implementation depends on provider)

    // Save assistant message
    db.prepare(`
      INSERT INTO chat_messages (session_id, role, content)
      VALUES (?, ?, ?)
    `).run(session, 'assistant', response.content);

    return NextResponse.json({
      message: response.content,
      sessionId: session,
    });

  } catch (error) {
    console.error('Agent error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Testing**:
- Integration test with mock LLM
- Test tool execution flow
- Test error handling

**Files to Create**:
- `app/api/agent/route.ts`
- `tests/integration/agent-api.test.ts`

---

## TRACK 4: API Routes (Parallel)

### #401: Shortcuts CRUD API

**Priority**: P1
**Estimated Complexity**: Medium
**Dependencies**: #001
**Assignable to**: Agent
**Parallel with**: #402, #403

**Description**:
Implement REST API for managing shortcuts (read from cache, trigger re-parse).

**Endpoints**:
- GET /api/shortcuts - List all cached shortcuts
- GET /api/shortcuts?app_id=nvim - Filter by app
- POST /api/shortcuts/refresh - Re-parse all config files

**Files to Create**:
- `app/api/shortcuts/route.ts`
- `app/api/shortcuts/refresh/route.ts`

---

### #402: Config Paths Management API

**Priority**: P1
**Estimated Complexity**: Medium
**Dependencies**: #001
**Assignable to**: Agent
**Parallel with**: #401, #403

**Description**:
Implement API for managing config file paths.

**Endpoints**:
- GET /api/config-paths - List all configured paths
- POST /api/config-paths - Add/update a path
- DELETE /api/config-paths/:id - Remove a path

**Files to Create**:
- `app/api/config-paths/route.ts`

---

### #403: User Preferences API

**Priority**: P2
**Estimated Complexity**: Small
**Dependencies**: #001
**Assignable to**: Agent
**Parallel with**: #401, #402

**Description**:
Implement API for user preferences (theme, LLM config, etc).

**Endpoints**:
- GET /api/preferences - Get all preferences
- POST /api/preferences - Update preferences

**Files to Create**:
- `app/api/preferences/route.ts`

---

## TRACK 5: Testing (Parallel)

### #501: Parser Unit Tests

**Priority**: P1
**Estimated Complexity**: Medium
**Dependencies**: #201, #202, #203, #204
**Assignable to**: Agent

**Description**:
Comprehensive unit tests for all parsers with real config file examples.

**Files to Create**:
- `tests/unit/parsers/neovim.test.ts`
- `tests/unit/parsers/tmux.test.ts`
- `tests/unit/parsers/zsh.test.ts`
- `tests/unit/parsers/vscode.test.ts`
- `tests/fixtures/` (sample config files)

---

### #502: Agent Integration Tests

**Priority**: P1
**Estimated Complexity**: Large
**Dependencies**: #301, #302, #303
**Assignable to**: Agent

**Description**:
Integration tests for the full agent flow (chat → tool execution → file modification).

**Files to Create**:
- `tests/integration/agent-flow.test.ts`

---

### #503: E2E User Flow Tests

**Priority**: P2
**Estimated Complexity**: Large
**Dependencies**: All UI components, API routes
**Assignable to**: Agent

**Description**:
Playwright E2E tests for critical user journeys.

**Test Cases**:
- User opens app, sees shortcuts
- User searches for a shortcut
- User opens settings, configures path
- User asks AI to create shortcut, verifies it appears

**Files to Create**:
- `tests/e2e/shortcuts.spec.ts`
- `tests/e2e/settings.spec.ts`
- `tests/e2e/ai-chat.spec.ts`

---

## Execution Strategy

### Phase 1: Foundation (Sequential)
1. Issue #001 (Setup + DB)
2. Issue #002 (Docker)
3. Issue #003 (Next.js + Tailwind)

### Phase 2: Parallel Development (All at once)
Launch agents for ALL of these simultaneously:
- Track 1: #101, #102, #103, #104
- Track 2: #201, #202, #203, #204
- Track 3: #301, #302, #303
- Track 4: #401, #402, #403

### Phase 3: Integration & Testing
- Track 5: #501, #502, #503
- Integration debugging
- Docker build verification

---

## Issue Template Format

Each issue will follow this format:

```markdown
# [TRACK X] Issue Title

**Priority**: P0/P1/P2
**Complexity**: Small/Medium/Large
**Dependencies**: #XXX, #YYY (or "None" for parallel work)
**Parallel with**: #AAA, #BBB (issues that can run simultaneously)

## Context
Brief description of what this issue accomplishes and why.

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Implementation Details
Code snippets, file structures, API designs.

## Testing
How to verify this work is complete.

## Files to Create/Modify
- path/to/file.ts
```

---

**Total Issues**: 20+ issues
**Parallelizable**: 15+ issues can run simultaneously
**Estimated Timeline**: With 10+ agents, core MVP completable in days instead of weeks

---

**Last Updated**: 2026-01-31
