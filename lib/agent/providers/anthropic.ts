import Anthropic from '@anthropic-ai/sdk';
import type { LLMConfig } from '@/lib/types';
import { LLMError } from '@/lib/types';
import { BaseLLMClient, LLMMessage, LLMResponse, ToolDefinition } from '../llm-client';

export class AnthropicClient extends BaseLLMClient {
  private client: Anthropic;

  constructor(config: LLMConfig) {
    super(config);
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const anthropicMessages: Anthropic.MessageParam[] = nonSystemMessages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    const anthropicTools: Anthropic.Tool[] | undefined = tools?.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        properties: tool.parameters.properties,
        required: tool.parameters.required,
      },
    }));

    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens || 2048,
        system: systemMessage?.content,
        messages: anthropicMessages,
        tools: anthropicTools,
      });

      let content = '';
      const toolCalls: { id: string; name: string; arguments: Record<string, unknown> }[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          content += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.input as Record<string, unknown>,
          });
        }
      }

      return {
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
        },
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *stream(messages: LLMMessage[]): AsyncIterable<string> {
    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const anthropicMessages: Anthropic.MessageParam[] = nonSystemMessages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    try {
      const stream = this.client.messages.stream({
        model: this.config.model,
        max_tokens: this.config.maxTokens || 2048,
        system: systemMessage?.content,
        messages: anthropicMessages,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): LLMError {
    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return new LLMError(
          'Invalid API key. Please check your Anthropic API key in Settings.',
          'INVALID_API_KEY',
          'anthropic',
          error
        );
      }
      if (error.status === 429) {
        return new LLMError(
          'Rate limit exceeded. Please wait before making more requests.',
          'RATE_LIMIT',
          'anthropic',
          error
        );
      }
      if (error.status === 404) {
        return new LLMError(
          `Model not found: ${this.config.model}. Please check the model name.`,
          'INVALID_MODEL',
          'anthropic',
          error
        );
      }
      if (error.message?.includes('context_length') || error.message?.includes('too long')) {
        return new LLMError(
          'Context length exceeded. Try reducing the input size.',
          'CONTEXT_LENGTH_EXCEEDED',
          'anthropic',
          error
        );
      }
      return new LLMError(
        error.message || 'Anthropic API error',
        'PROVIDER_ERROR',
        'anthropic',
        error
      );
    }

    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('network')) {
        return new LLMError(
          'Network error. Please check your internet connection.',
          'NETWORK_ERROR',
          'anthropic',
          error
        );
      }
      return new LLMError(error.message, 'PROVIDER_ERROR', 'anthropic', error);
    }

    return new LLMError('Unknown error occurred', 'PROVIDER_ERROR', 'anthropic');
  }
}
