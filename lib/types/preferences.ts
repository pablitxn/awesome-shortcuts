// User preferences types for Awesome Shortcuts

import type { LLMProvider } from '@/lib/types';

// Theme options
export type Theme = 'dark' | 'light';

// LLM configuration stored in preferences (without sensitive data in responses)
export interface LLMConfigPreference {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

// Safe LLM config returned in GET (API key masked)
export interface SafeLLMConfigPreference {
  provider: LLMProvider;
  model: string;
  hasApiKey: boolean;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

// Preference keys enum for type safety
export const PREFERENCE_KEYS = {
  THEME: 'theme',
  LLM_CONFIG: 'llm_config',
  SHORTCUTS_PER_PAGE: 'shortcuts_per_page',
  DEFAULT_CATEGORY: 'default_category',
} as const;

export type PreferenceKey = (typeof PREFERENCE_KEYS)[keyof typeof PREFERENCE_KEYS];

// Default values for preferences
export const DEFAULT_PREFERENCES = {
  [PREFERENCE_KEYS.THEME]: 'dark' as Theme,
  [PREFERENCE_KEYS.LLM_CONFIG]: {
    provider: 'openai' as LLMProvider,
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2048,
  } as LLMConfigPreference,
  [PREFERENCE_KEYS.SHORTCUTS_PER_PAGE]: 25,
  [PREFERENCE_KEYS.DEFAULT_CATEGORY]: 'all',
} as const;

// Full preferences object returned by GET
export interface UserPreferences {
  theme: Theme;
  llm_config: SafeLLMConfigPreference;
  shortcuts_per_page: number;
  default_category: string;
}

// Partial preferences for POST (upsert)
export interface UserPreferencesInput {
  theme?: Theme;
  llm_config?: LLMConfigPreference;
  shortcuts_per_page?: number;
  default_category?: string;
}

// API response types
export interface PreferencesGetResponse {
  success: true;
  data: UserPreferences;
}

export interface PreferencesPostResponse {
  success: true;
  data: {
    updated: PreferenceKey[];
  };
}

export interface PreferencesErrorResponse {
  success: false;
  error: string;
}

// Validation helpers
export function isValidTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light';
}

export function isValidLLMConfig(value: unknown): value is LLMConfigPreference {
  if (typeof value !== 'object' || value === null) return false;

  const config = value as Record<string, unknown>;

  // Required fields
  if (!config.provider || !['openai', 'anthropic', 'ollama'].includes(config.provider as string)) {
    return false;
  }
  if (typeof config.model !== 'string' || config.model.length === 0) {
    return false;
  }

  // Optional fields validation
  if (config.apiKey !== undefined && typeof config.apiKey !== 'string') {
    return false;
  }
  if (config.baseUrl !== undefined && typeof config.baseUrl !== 'string') {
    return false;
  }
  if (config.temperature !== undefined && (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2)) {
    return false;
  }
  if (config.maxTokens !== undefined && (typeof config.maxTokens !== 'number' || config.maxTokens < 1)) {
    return false;
  }

  return true;
}

export function isValidShortcutsPerPage(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 5 && value <= 100;
}

export function isValidDefaultCategory(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 50;
}

// Sanitize LLM config to remove sensitive data
export function sanitizeLLMConfig(config: LLMConfigPreference): SafeLLMConfigPreference {
  const { apiKey, ...rest } = config;
  return {
    ...rest,
    hasApiKey: Boolean(apiKey && apiKey.length > 0),
  };
}
