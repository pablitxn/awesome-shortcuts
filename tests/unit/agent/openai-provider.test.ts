import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMError } from '@/lib/types';
import type { LLMConfig } from '@/lib/types';

// Create a mock APIError class
class MockOpenAIAPIError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'APIError';
  }
}

// Mock OpenAI SDK - use vi.hoisted for variables that need to be accessible in vi.mock
const { mockCreate, MockAPIError } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  MockAPIError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'APIError';
    }
  },
}));

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
      static APIError = MockAPIError;
    },
  };
});

import { OpenAIClient } from '@/lib/agent/providers/openai';

describe('OpenAI Provider', () => {
  let client: OpenAIClient;
  const config: LLMConfig = {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: 'sk-test-key',
    temperature: 0.7,
    maxTokens: 2048,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new OpenAIClient(config);
  });

  describe('chat()', () => {
    it('should return successful response', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'Hello! How can I help you?',
              tool_calls: undefined,
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
        },
      });

      const response = await client.chat([
        { role: 'user', content: 'Hello' },
      ]);

      expect(response.content).toBe('Hello! How can I help you?');
      expect(response.usage?.promptTokens).toBe(10);
      expect(response.usage?.completionTokens).toBe(20);
    });

    it('should handle tool calls in response', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '',
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'read_config',
                    arguments: '{"app_id": "nvim"}',
                  },
                },
              ],
            },
          },
        ],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 25,
        },
      });

      const response = await client.chat(
        [{ role: 'user', content: 'Read my nvim config' }],
        [
          {
            name: 'read_config',
            description: 'Read a config file',
            parameters: {
              type: 'object',
              properties: {
                app_id: { type: 'string', description: 'The app ID' },
              },
              required: ['app_id'],
            },
          },
        ]
      );

      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls?.[0].name).toBe('read_config');
      expect(response.toolCalls?.[0].arguments).toEqual({ app_id: 'nvim' });
    });

    it('should throw LLMError for 401 Unauthorized', async () => {
      const apiError = new MockAPIError(401, 'Invalid API key');
      mockCreate.mockRejectedValueOnce(apiError);

      await expect(client.chat([{ role: 'user', content: 'test' }]))
        .rejects.toThrow(LLMError);

      mockCreate.mockRejectedValueOnce(new MockAPIError(401, 'Invalid API key'));
      try {
        await client.chat([{ role: 'user', content: 'test' }]);
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe('INVALID_API_KEY');
        expect((error as LLMError).provider).toBe('openai');
      }
    });

    it('should throw LLMError for 429 Rate Limit', async () => {
      const apiError = new MockAPIError(429, 'Rate limit exceeded');
      mockCreate.mockRejectedValueOnce(apiError);

      await expect(client.chat([{ role: 'user', content: 'test' }]))
        .rejects.toThrow(LLMError);

      mockCreate.mockRejectedValueOnce(new MockAPIError(429, 'Rate limit exceeded'));
      try {
        await client.chat([{ role: 'user', content: 'test' }]);
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe('RATE_LIMIT');
      }
    });

    it('should throw LLMError for 404 Model Not Found', async () => {
      const apiError = new MockAPIError(404, 'Model not found');
      mockCreate.mockRejectedValueOnce(apiError);

      await expect(client.chat([{ role: 'user', content: 'test' }]))
        .rejects.toThrow(LLMError);

      mockCreate.mockRejectedValueOnce(new MockAPIError(404, 'Model not found'));
      try {
        await client.chat([{ role: 'user', content: 'test' }]);
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe('INVALID_MODEL');
      }
    });

    it('should handle network errors', async () => {
      const networkError = new Error('ECONNREFUSED');
      mockCreate.mockRejectedValueOnce(networkError);

      await expect(client.chat([{ role: 'user', content: 'test' }]))
        .rejects.toThrow(LLMError);

      mockCreate.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      try {
        await client.chat([{ role: 'user', content: 'test' }]);
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe('NETWORK_ERROR');
      }
    });

    it('should pass messages with all roles correctly', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });

      await client.chat([
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ]);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' }),
            expect.objectContaining({ role: 'assistant' }),
          ]),
        })
      );
    });
  });

  describe('stream()', () => {
    it('should yield content chunks', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'Hello' } }] };
          yield { choices: [{ delta: { content: ' world' } }] };
          yield { choices: [{ delta: { content: '!' } }] };
        },
      };

      mockCreate.mockResolvedValueOnce(mockStream);

      const chunks: string[] = [];
      for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello', ' world', '!']);
    });

    it('should skip empty content chunks', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'Hello' } }] };
          yield { choices: [{ delta: {} }] };
          yield { choices: [{ delta: { content: '' } }] };
          yield { choices: [{ delta: { content: ' world' } }] };
        },
      };

      mockCreate.mockResolvedValueOnce(mockStream);

      const chunks: string[] = [];
      for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello', ' world']);
    });

    it('should handle stream errors', async () => {
      const apiError = new MockAPIError(401, 'Invalid API key');
      mockCreate.mockRejectedValueOnce(apiError);

      const stream = client.stream([{ role: 'user', content: 'test' }]);

      await expect(async () => {
        for await (const _ of stream) {
          // consume stream
        }
      }).rejects.toThrow(LLMError);
    });
  });

  describe('constructor', () => {
    it('should create client with provided config', () => {
      const customConfig: LLMConfig = {
        ...config,
        baseUrl: 'https://custom-api.example.com',
      };

      const customClient = new OpenAIClient(customConfig);
      expect(customClient).toBeDefined();
    });
  });
});
