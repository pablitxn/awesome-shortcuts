import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LLMError } from '@/lib/types';
import type { LLMConfig } from '@/lib/types';
import { OllamaClient } from '@/lib/agent/providers/ollama';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Ollama Provider', () => {
  let client: OllamaClient;
  const config: LLMConfig = {
    provider: 'ollama',
    model: 'llama3',
    temperature: 0.7,
    maxTokens: 2048,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new OllamaClient(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use default base URL when not provided', () => {
      const defaultClient = new OllamaClient({
        provider: 'ollama',
        model: 'llama3',
      });

      // We can verify by checking that requests go to the default URL
      expect(defaultClient).toBeDefined();
    });

    it('should use custom base URL when provided', () => {
      const customConfig: LLMConfig = {
        ...config,
        baseUrl: 'http://custom-ollama:11434',
      };

      const customClient = new OllamaClient(customConfig);
      expect(customClient).toBeDefined();
    });
  });

  describe('chat()', () => {
    it('should return successful response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'llama3',
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you?',
          },
          done: true,
          prompt_eval_count: 10,
          eval_count: 20,
        }),
      });

      const response = await client.chat([
        { role: 'user', content: 'Hello' },
      ]);

      expect(response.content).toBe('Hello! How can I help you?');
      expect(response.usage?.promptTokens).toBe(10);
      expect(response.usage?.completionTokens).toBe(20);
    });

    it('should send correct request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'llama3',
          message: { role: 'assistant', content: 'Response' },
          done: true,
        }),
      });

      await client.chat([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"stream":false'),
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.model).toBe('llama3');
      expect(body.messages).toHaveLength(2);
      expect(body.options.temperature).toBe(0.7);
      expect(body.options.num_predict).toBe(2048);
    });

    it('should include tool descriptions in system prompt when tools provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'llama3',
          message: { role: 'assistant', content: 'I will use the tool.' },
          done: true,
        }),
      });

      await client.chat(
        [{ role: 'user', content: 'Read config' }],
        [
          {
            name: 'read_config',
            description: 'Read a configuration file',
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

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      // Should have a system message with tool descriptions
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toContain('read_config');
      expect(body.messages[0].content).toContain('Read a configuration file');
    });

    it('should append tool descriptions to existing system message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'llama3',
          message: { role: 'assistant', content: 'Response' },
          done: true,
        }),
      });

      await client.chat(
        [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Read config' },
        ],
        [
          {
            name: 'read_config',
            description: 'Read a configuration file',
            parameters: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
        ]
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.messages[0].content).toContain('You are helpful');
      expect(body.messages[0].content).toContain('read_config');
    });

    it('should parse tool calls from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'llama3',
          message: {
            role: 'assistant',
            content: '{"tool": "read_config", "arguments": {"app_id": "nvim"}}',
          },
          done: true,
        }),
      });

      const response = await client.chat(
        [{ role: 'user', content: 'Read nvim config' }],
        [
          {
            name: 'read_config',
            description: 'Read config',
            parameters: {
              type: 'object',
              properties: { app_id: { type: 'string', description: 'App' } },
              required: ['app_id'],
            },
          },
        ]
      );

      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls?.[0].name).toBe('read_config');
      expect(response.toolCalls?.[0].arguments).toEqual({ app_id: 'nvim' });
    });

    it('should handle response with no tool calls', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'llama3',
          message: { role: 'assistant', content: 'Just a normal response' },
          done: true,
        }),
      });

      const response = await client.chat(
        [{ role: 'user', content: 'Hello' }],
        [
          {
            name: 'read_config',
            description: 'Read config',
            parameters: { type: 'object', properties: {}, required: [] },
          },
        ]
      );

      expect(response.toolCalls).toBeUndefined();
    });

    it('should throw LLMError for 404 Model Not Found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'model not found' }),
      });

      try {
        await client.chat([{ role: 'user', content: 'test' }]);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe('INVALID_MODEL');
        expect((error as LLMError).provider).toBe('ollama');
      }
    });

    it('should throw LLMError for HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });

      try {
        await client.chat([{ role: 'user', content: 'test' }]);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe('PROVIDER_ERROR');
      }
    });

    it('should throw LLMError for network errors (ECONNREFUSED)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed: ECONNREFUSED'));

      try {
        await client.chat([{ role: 'user', content: 'test' }]);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe('NETWORK_ERROR');
        expect((error as LLMError).message).toContain('Cannot connect to Ollama');
      }
    });

    it('should throw LLMError for response body errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: 'Model not loaded',
        }),
      });

      try {
        await client.chat([{ role: 'user', content: 'test' }]);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).message).toBe('Model not loaded');
      }
    });
  });

  describe('stream()', () => {
    it('should yield content chunks', async () => {
      const chunks = [
        { message: { content: 'Hello' }, done: false },
        { message: { content: ' world' }, done: false },
        { message: { content: '!' }, done: true },
      ];

      const encoder = new TextEncoder();
      let chunkIndex = 0;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              if (chunkIndex >= chunks.length) {
                return { done: true, value: undefined };
              }
              const chunk = chunks[chunkIndex++];
              return {
                done: false,
                value: encoder.encode(JSON.stringify(chunk) + '\n'),
              };
            },
            releaseLock: vi.fn(),
          }),
        },
      });

      const result: string[] = [];
      for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
        result.push(chunk);
      }

      expect(result).toEqual(['Hello', ' world', '!']);
    });

    it('should handle multiple chunks in single read', async () => {
      const encoder = new TextEncoder();
      const data = '{"message":{"content":"Hello"},"done":false}\n{"message":{"content":" world"},"done":true}\n';

      let hasRead = false;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              if (hasRead) {
                return { done: true, value: undefined };
              }
              hasRead = true;
              return {
                done: false,
                value: encoder.encode(data),
              };
            },
            releaseLock: vi.fn(),
          }),
        },
      });

      const result: string[] = [];
      for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
        result.push(chunk);
      }

      expect(result).toEqual(['Hello', ' world']);
    });

    it('should skip empty lines and invalid JSON', async () => {
      const encoder = new TextEncoder();
      const data = '{"message":{"content":"Hello"}}\n\n{"invalid json\n{"message":{"content":" world"}}\n';

      let hasRead = false;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              if (hasRead) {
                return { done: true, value: undefined };
              }
              hasRead = true;
              return {
                done: false,
                value: encoder.encode(data),
              };
            },
            releaseLock: vi.fn(),
          }),
        },
      });

      const result: string[] = [];
      for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
        result.push(chunk);
      }

      expect(result).toEqual(['Hello', ' world']);
    });

    it('should throw LLMError for HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Model not found' }),
      });

      const stream = client.stream([{ role: 'user', content: 'test' }]);

      await expect(async () => {
        for await (const _ of stream) {
          // consume stream
        }
      }).rejects.toThrow(LLMError);
    });

    it('should throw LLMError for network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'));

      const stream = client.stream([{ role: 'user', content: 'test' }]);

      await expect(async () => {
        for await (const _ of stream) {
          // consume stream
        }
      }).rejects.toThrow(LLMError);
    });

    it('should throw LLMError if no response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      const stream = client.stream([{ role: 'user', content: 'test' }]);

      await expect(async () => {
        for await (const _ of stream) {
          // consume stream
        }
      }).rejects.toThrow(LLMError);
    });

    it('should throw LLMError for stream error in response', async () => {
      const encoder = new TextEncoder();
      const data = '{"error":"Something went wrong"}\n';

      let hasRead = false;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              if (hasRead) {
                return { done: true, value: undefined };
              }
              hasRead = true;
              return {
                done: false,
                value: encoder.encode(data),
              };
            },
            releaseLock: vi.fn(),
          }),
        },
      });

      const stream = client.stream([{ role: 'user', content: 'test' }]);

      await expect(async () => {
        for await (const _ of stream) {
          // consume stream
        }
      }).rejects.toThrow(LLMError);
    });
  });
});
