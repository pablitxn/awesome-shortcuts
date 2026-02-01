import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMError } from '@/lib/types';
import type { LLMConfig } from '@/lib/types';

// Mock Anthropic SDK - use vi.hoisted for variables
const { mockMessagesCreate, mockMessagesStream, MockAPIError } = vi.hoisted(() => ({
  mockMessagesCreate: vi.fn(),
  mockMessagesStream: vi.fn(),
  MockAPIError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'APIError';
    }
  },
}));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockMessagesCreate,
        stream: mockMessagesStream,
      };
      static APIError = MockAPIError;
    },
  };
});

import { AnthropicClient } from '@/lib/agent/providers/anthropic';

describe('Anthropic Provider', () => {
  let client: AnthropicClient;
  const config: LLMConfig = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKey: 'sk-ant-test-key',
    maxTokens: 2048,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new AnthropicClient(config);
  });

  describe('chat()', () => {
    it('should return successful response with text content', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'Hello! How can I help you?' },
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
      });

      const response = await client.chat([
        { role: 'user', content: 'Hello' },
      ]);

      expect(response.content).toBe('Hello! How can I help you?');
      expect(response.usage?.promptTokens).toBe(10);
      expect(response.usage?.completionTokens).toBe(20);
    });

    it('should handle system messages separately', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await client.chat([
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
      ]);

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a helpful assistant',
          messages: [{ role: 'user', content: 'Hello' }],
        })
      );
    });

    it('should handle tool use in response', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'I will read the config for you.' },
          {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'read_config',
            input: { app_id: 'nvim' },
          },
        ],
        usage: { input_tokens: 15, output_tokens: 25 },
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

      expect(response.content).toBe('I will read the config for you.');
      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls?.[0].id).toBe('toolu_123');
      expect(response.toolCalls?.[0].name).toBe('read_config');
      expect(response.toolCalls?.[0].arguments).toEqual({ app_id: 'nvim' });
    });

    it('should throw LLMError for 401 Unauthorized', async () => {
      const apiError = new MockAPIError(401, 'Invalid API key');
      mockMessagesCreate.mockRejectedValueOnce(apiError);

      await expect(client.chat([{ role: 'user', content: 'test' }]))
        .rejects.toThrow(LLMError);

      mockMessagesCreate.mockRejectedValueOnce(new MockAPIError(401, 'Invalid API key'));
      try {
        await client.chat([{ role: 'user', content: 'test' }]);
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe('INVALID_API_KEY');
        expect((error as LLMError).provider).toBe('anthropic');
      }
    });

    it('should throw LLMError for 429 Rate Limit', async () => {
      mockMessagesCreate.mockRejectedValueOnce(new MockAPIError(429, 'Rate limit exceeded'));

      try {
        await client.chat([{ role: 'user', content: 'test' }]);
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe('RATE_LIMIT');
      }
    });

    it('should throw LLMError for 404 Model Not Found', async () => {
      mockMessagesCreate.mockRejectedValueOnce(new MockAPIError(404, 'Model not found'));

      try {
        await client.chat([{ role: 'user', content: 'test' }]);
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe('INVALID_MODEL');
      }
    });

    it('should handle network errors', async () => {
      mockMessagesCreate.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      try {
        await client.chat([{ role: 'user', content: 'test' }]);
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe('NETWORK_ERROR');
      }
    });

    it('should use default maxTokens when not provided', async () => {
      const noMaxTokensConfig: LLMConfig = {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        apiKey: 'sk-ant-test',
      };
      const clientNoMax = new AnthropicClient(noMaxTokensConfig);

      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await clientNoMax.chat([{ role: 'user', content: 'Hello' }]);

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 2048,
        })
      );
    });
  });

  describe('stream()', () => {
    it('should yield text delta content', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '!' } };
        },
      };

      mockMessagesStream.mockReturnValueOnce(mockStream);

      const chunks: string[] = [];
      for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello', ' world', '!']);
    });

    it('should skip non-text events', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'message_start' };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } };
          yield { type: 'content_block_start' };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } };
          yield { type: 'message_stop' };
        },
      };

      mockMessagesStream.mockReturnValueOnce(mockStream);

      const chunks: string[] = [];
      for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello', ' world']);
    });

    it('should handle stream with system message', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Response' } };
        },
      };

      mockMessagesStream.mockReturnValueOnce(mockStream);

      const chunks: string[] = [];
      for await (const chunk of client.stream([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hi' },
      ])) {
        chunks.push(chunk);
      }

      expect(mockMessagesStream).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are helpful',
        })
      );
    });

    it('should handle stream errors', async () => {
      const apiError = new MockAPIError(401, 'Invalid API key');
      mockMessagesStream.mockImplementationOnce(() => {
        throw apiError;
      });

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

      const customClient = new AnthropicClient(customConfig);
      expect(customClient).toBeDefined();
    });
  });
});
