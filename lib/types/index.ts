// Shared types for Awesome Shortcuts

export interface ConfigPath {
  id: number;
  app_id: string;
  path: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Shortcut {
  id: number;
  app_id: string;
  title: string;
  keys: string[];
  description: string | null;
  source_file: string;
  source_line: number | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface UserPreference {
  key: string;
  value: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: number;
  action: 'create' | 'update' | 'delete';
  target_file: string;
  diff: string | null;
  ai_request: string | null;
  created_at: string;
}

// Parser interface for config file parsers
export interface ConfigParser {
  appId: string;
  detect: (filePath: string) => boolean;
  parse: (fileContent: string) => ParsedShortcut[];
  inject: (fileContent: string, shortcut: ParsedShortcut) => string;
}

export interface ParsedShortcut {
  title: string;
  keys: string[];
  description?: string;
  sourceLine?: number;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// LLM configuration types
export type LLMProvider = 'openai' | 'anthropic' | 'ollama';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}
