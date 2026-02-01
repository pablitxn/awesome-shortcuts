import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLLMConfig, createLLMClient, type LLMMessage, type ToolDefinition } from '@/lib/agent/llm-client';
import type { LLMConfig } from '@/lib/types';

// Mock the database queries
vi.mock('@/lib/db/queries', () => ({
  userPreferences: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

// Import after mocking
import { userPreferences } from '@/lib/db/queries';

describe('LLM Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLLMConfig', () => {
    it('should return default config when no preferences set', () => {
      vi.mocked(userPreferences.get).mockReturnValue(undefined);

      const config = getLLMConfig();

      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4o-mini');
      expect(config.temperature).toBe(0.7);
      expect(config.maxTokens).toBe(2048);
    });

    it('should return OpenAI config from preferences', () => {
      vi.mocked(userPreferences.get).mockImplementation((key: string) => {
        const prefs: Record<string, string> = {
          llm_provider: 'openai',
          llm_model: 'gpt-4',
          llm_api_key: 'sk-test-key',
          llm_temperature: '0.5',
          llm_max_tokens: '4096',
        };
        return prefs[key];
      });

      const config = getLLMConfig();

      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4');
      expect(config.apiKey).toBe('sk-test-key');
      expect(config.temperature).toBe(0.5);
      expect(config.maxTokens).toBe(4096);
    });

    it('should return Anthropic config from preferences', () => {
      vi.mocked(userPreferences.get).mockImplementation((key: string) => {
        const prefs: Record<string, string> = {
          llm_provider: 'anthropic',
          llm_model: 'claude-3-5-sonnet-20241022',
          llm_api_key: 'sk-ant-test-key',
        };
        return prefs[key];
      });

      const config = getLLMConfig();

      expect(config.provider).toBe('anthropic');
      expect(config.model).toBe('claude-3-5-sonnet-20241022');
      expect(config.apiKey).toBe('sk-ant-test-key');
    });

    it('should return Ollama config with default base URL', () => {
      vi.mocked(userPreferences.get).mockImplementation((key: string) => {
        const prefs: Record<string, string> = {
          llm_provider: 'ollama',
          llm_model: 'llama3',
        };
        return prefs[key];
      });

      const config = getLLMConfig();

      expect(config.provider).toBe('ollama');
      expect(config.model).toBe('llama3');
      expect(config.apiKey).toBeUndefined();
    });

    it('should return default model for each provider', () => {
      // OpenAI default
      vi.mocked(userPreferences.get).mockImplementation((key: string) => {
        if (key === 'llm_provider') return 'openai';
        return undefined;
      });
      expect(getLLMConfig().model).toBe('gpt-4o-mini');

      // Anthropic default
      vi.mocked(userPreferences.get).mockImplementation((key: string) => {
        if (key === 'llm_provider') return 'anthropic';
        return undefined;
      });
      expect(getLLMConfig().model).toBe('claude-3-5-sonnet-20241022');

      // Ollama default
      vi.mocked(userPreferences.get).mockImplementation((key: string) => {
        if (key === 'llm_provider') return 'ollama';
        return undefined;
      });
      expect(getLLMConfig().model).toBe('llama3');
    });
  });

  describe('createLLMClient', () => {
    it('should create OpenAI client', async () => {
      const config: LLMConfig = {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'sk-test',
      };

      const client = await createLLMClient(config);

      expect(client).toBeDefined();
      expect(client.constructor.name).toBe('OpenAIClient');
    });

    it('should create Anthropic client', async () => {
      const config: LLMConfig = {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'sk-ant-test',
      };

      const client = await createLLMClient(config);

      expect(client).toBeDefined();
      expect(client.constructor.name).toBe('AnthropicClient');
    });

    it('should create Ollama client', async () => {
      const config: LLMConfig = {
        provider: 'ollama',
        model: 'llama3',
      };

      const client = await createLLMClient(config);

      expect(client).toBeDefined();
      expect(client.constructor.name).toBe('OllamaClient');
    });

    it('should throw error for unknown provider', async () => {
      const config = {
        provider: 'unknown',
        model: 'test',
      } as unknown as LLMConfig;

      await expect(createLLMClient(config)).rejects.toThrow('Unknown provider');
    });

    it('should use default config when none provided', async () => {
      vi.mocked(userPreferences.get).mockImplementation((key: string) => {
        const prefs: Record<string, string> = {
          llm_provider: 'openai',
          llm_api_key: 'sk-test',
        };
        return prefs[key];
      });

      const client = await createLLMClient();

      expect(client).toBeDefined();
      expect(client.constructor.name).toBe('OpenAIClient');
    });
  });

  describe('LLMMessage interface', () => {
    it('should support user role', () => {
      const message: LLMMessage = {
        role: 'user',
        content: 'Hello',
      };

      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello');
    });

    it('should support assistant role', () => {
      const message: LLMMessage = {
        role: 'assistant',
        content: 'Hi there!',
      };

      expect(message.role).toBe('assistant');
    });

    it('should support system role', () => {
      const message: LLMMessage = {
        role: 'system',
        content: 'You are a helpful assistant.',
      };

      expect(message.role).toBe('system');
    });
  });

  describe('ToolDefinition interface', () => {
    it('should have correct structure', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {
            param1: {
              type: 'string',
              description: 'First parameter',
            },
            param2: {
              type: 'string',
              description: 'Second parameter',
              enum: ['option1', 'option2'],
            },
          },
          required: ['param1'],
        },
      };

      expect(tool.name).toBe('test_tool');
      expect(tool.description).toBe('A test tool');
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.properties.param1.type).toBe('string');
      expect(tool.parameters.properties.param2.enum).toEqual(['option1', 'option2']);
      expect(tool.parameters.required).toContain('param1');
    });
  });
});
