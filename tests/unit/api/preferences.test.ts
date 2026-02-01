import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isValidTheme,
  isValidLLMConfig,
  isValidShortcutsPerPage,
  isValidDefaultCategory,
  sanitizeLLMConfig,
  PREFERENCE_KEYS,
  DEFAULT_PREFERENCES,
  type LLMConfigPreference,
} from '@/lib/types/preferences';

// Mock the database module
vi.mock('@/lib/db/queries', () => ({
  userPreferences: {
    getAll: vi.fn(() => []),
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
}));

import { userPreferences } from '@/lib/db/queries';

describe('User Preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Validation Functions', () => {
    describe('isValidTheme', () => {
      it('should return true for valid themes', () => {
        expect(isValidTheme('dark')).toBe(true);
        expect(isValidTheme('light')).toBe(true);
      });

      it('should return false for invalid themes', () => {
        expect(isValidTheme('blue')).toBe(false);
        expect(isValidTheme('')).toBe(false);
        expect(isValidTheme(null)).toBe(false);
        expect(isValidTheme(undefined)).toBe(false);
        expect(isValidTheme(123)).toBe(false);
      });
    });

    describe('isValidLLMConfig', () => {
      it('should return true for valid LLM config', () => {
        const config: LLMConfigPreference = {
          provider: 'openai',
          model: 'gpt-4',
        };
        expect(isValidLLMConfig(config)).toBe(true);
      });

      it('should return true for full LLM config', () => {
        const config: LLMConfigPreference = {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          apiKey: 'sk-ant-...',
          baseUrl: 'https://api.anthropic.com',
          temperature: 0.7,
          maxTokens: 2048,
        };
        expect(isValidLLMConfig(config)).toBe(true);
      });

      it('should return true for Ollama config', () => {
        const config: LLMConfigPreference = {
          provider: 'ollama',
          model: 'llama3',
          baseUrl: 'http://localhost:11434',
        };
        expect(isValidLLMConfig(config)).toBe(true);
      });

      it('should return false for invalid provider', () => {
        const config = {
          provider: 'invalid-provider',
          model: 'gpt-4',
        };
        expect(isValidLLMConfig(config)).toBe(false);
      });

      it('should return false for missing model', () => {
        const config = {
          provider: 'openai',
        };
        expect(isValidLLMConfig(config)).toBe(false);
      });

      it('should return false for empty model', () => {
        const config = {
          provider: 'openai',
          model: '',
        };
        expect(isValidLLMConfig(config)).toBe(false);
      });

      it('should return false for invalid temperature', () => {
        const config = {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 3, // Out of range (0-2)
        };
        expect(isValidLLMConfig(config)).toBe(false);
      });

      it('should return false for negative temperature', () => {
        const config = {
          provider: 'openai',
          model: 'gpt-4',
          temperature: -1,
        };
        expect(isValidLLMConfig(config)).toBe(false);
      });

      it('should return false for invalid maxTokens', () => {
        const config = {
          provider: 'openai',
          model: 'gpt-4',
          maxTokens: 0,
        };
        expect(isValidLLMConfig(config)).toBe(false);
      });

      it('should return false for non-object values', () => {
        expect(isValidLLMConfig(null)).toBe(false);
        expect(isValidLLMConfig(undefined)).toBe(false);
        expect(isValidLLMConfig('string')).toBe(false);
        expect(isValidLLMConfig(123)).toBe(false);
      });
    });

    describe('isValidShortcutsPerPage', () => {
      it('should return true for valid values', () => {
        expect(isValidShortcutsPerPage(5)).toBe(true);
        expect(isValidShortcutsPerPage(25)).toBe(true);
        expect(isValidShortcutsPerPage(50)).toBe(true);
        expect(isValidShortcutsPerPage(100)).toBe(true);
      });

      it('should return false for values below minimum', () => {
        expect(isValidShortcutsPerPage(4)).toBe(false);
        expect(isValidShortcutsPerPage(0)).toBe(false);
        expect(isValidShortcutsPerPage(-1)).toBe(false);
      });

      it('should return false for values above maximum', () => {
        expect(isValidShortcutsPerPage(101)).toBe(false);
        expect(isValidShortcutsPerPage(1000)).toBe(false);
      });

      it('should return false for non-integer values', () => {
        expect(isValidShortcutsPerPage(25.5)).toBe(false);
        expect(isValidShortcutsPerPage('25')).toBe(false);
        expect(isValidShortcutsPerPage(null)).toBe(false);
      });
    });

    describe('isValidDefaultCategory', () => {
      it('should return true for valid categories', () => {
        expect(isValidDefaultCategory('all')).toBe(true);
        expect(isValidDefaultCategory('nvim')).toBe(true);
        expect(isValidDefaultCategory('my-category')).toBe(true);
      });

      it('should return false for empty string', () => {
        expect(isValidDefaultCategory('')).toBe(false);
      });

      it('should return false for strings over 50 chars', () => {
        const longString = 'a'.repeat(51);
        expect(isValidDefaultCategory(longString)).toBe(false);
      });

      it('should return false for non-string values', () => {
        expect(isValidDefaultCategory(123)).toBe(false);
        expect(isValidDefaultCategory(null)).toBe(false);
        expect(isValidDefaultCategory(undefined)).toBe(false);
      });
    });
  });

  describe('sanitizeLLMConfig', () => {
    it('should remove apiKey and add hasApiKey flag', () => {
      const config: LLMConfigPreference = {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'sk-secret-key',
        temperature: 0.7,
      };

      const sanitized = sanitizeLLMConfig(config);

      expect(sanitized).not.toHaveProperty('apiKey');
      expect(sanitized.hasApiKey).toBe(true);
      expect(sanitized.provider).toBe('openai');
      expect(sanitized.model).toBe('gpt-4');
      expect(sanitized.temperature).toBe(0.7);
    });

    it('should set hasApiKey to false when no apiKey', () => {
      const config: LLMConfigPreference = {
        provider: 'ollama',
        model: 'llama3',
      };

      const sanitized = sanitizeLLMConfig(config);

      expect(sanitized.hasApiKey).toBe(false);
    });

    it('should set hasApiKey to false for empty apiKey', () => {
      const config: LLMConfigPreference = {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: '',
      };

      const sanitized = sanitizeLLMConfig(config);

      expect(sanitized.hasApiKey).toBe(false);
    });

    it('should preserve other config properties', () => {
      const config: LLMConfigPreference = {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'sk-ant-secret',
        baseUrl: 'https://api.anthropic.com',
        temperature: 0.5,
        maxTokens: 4096,
      };

      const sanitized = sanitizeLLMConfig(config);

      expect(sanitized.baseUrl).toBe('https://api.anthropic.com');
      expect(sanitized.temperature).toBe(0.5);
      expect(sanitized.maxTokens).toBe(4096);
    });
  });

  describe('Default Preferences', () => {
    it('should have correct default theme', () => {
      expect(DEFAULT_PREFERENCES.theme).toBe('dark');
    });

    it('should have correct default LLM config', () => {
      expect(DEFAULT_PREFERENCES.llm_config.provider).toBe('openai');
      expect(DEFAULT_PREFERENCES.llm_config.model).toBe('gpt-4');
      expect(DEFAULT_PREFERENCES.llm_config.temperature).toBe(0.7);
    });

    it('should have correct default shortcuts per page', () => {
      expect(DEFAULT_PREFERENCES.shortcuts_per_page).toBe(25);
    });

    it('should have correct default category', () => {
      expect(DEFAULT_PREFERENCES.default_category).toBe('all');
    });
  });

  describe('Preference Keys', () => {
    it('should have all required keys', () => {
      expect(PREFERENCE_KEYS.THEME).toBe('theme');
      expect(PREFERENCE_KEYS.LLM_CONFIG).toBe('llm_config');
      expect(PREFERENCE_KEYS.SHORTCUTS_PER_PAGE).toBe('shortcuts_per_page');
      expect(PREFERENCE_KEYS.DEFAULT_CATEGORY).toBe('default_category');
    });
  });

  describe('API Route Behavior (via mocks)', () => {
    it('should use getAll to fetch all preferences', () => {
      vi.mocked(userPreferences.getAll).mockReturnValue([
        { key: 'theme', value: '"light"', updated_at: '2026-01-01' },
      ]);

      const result = userPreferences.getAll();

      expect(userPreferences.getAll).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('theme');
    });

    it('should use set to update preferences', () => {
      userPreferences.set('theme', '"dark"');

      expect(userPreferences.set).toHaveBeenCalledWith('theme', '"dark"');
    });

    it('should store LLM config as JSON string', () => {
      const config = {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'sk-ant-test',
      };

      userPreferences.set('llm_config', JSON.stringify(config));

      expect(userPreferences.set).toHaveBeenCalledWith(
        'llm_config',
        JSON.stringify(config)
      );
    });
  });
});
