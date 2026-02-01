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

// LLM client types
export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: LLMToolParameter;
  properties?: Record<string, LLMToolParameter>;
  required?: string[];
}

export interface LLMTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, LLMToolParameter>;
    required?: string[];
  };
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  toolCalls?: LLMToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

// LLM error types
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: LLMErrorCode,
    public readonly provider: LLMProvider,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export type LLMErrorCode =
  | 'INVALID_API_KEY'
  | 'RATE_LIMIT'
  | 'NETWORK_ERROR'
  | 'INVALID_MODEL'
  | 'CONTEXT_LENGTH_EXCEEDED'
  | 'PROVIDER_ERROR'
  | 'CONFIGURATION_ERROR';
