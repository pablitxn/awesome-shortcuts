import OpenAI from 'openai';
import type { LLMConfig } from '@/lib/types';
import { LLMError } from '@/lib/types';
import { BaseLLMClient, LLMMessage, LLMResponse, ToolDefinition } from '../llm-client';

export class OpenAIClient extends BaseLLMClient {
  private client: OpenAI;

  constructor(config: LLMConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    const openaiTools: OpenAI.Chat.ChatCompletionTool[] | undefined = tools?.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: openaiMessages,
        tools: openaiTools,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      const choice = response.choices[0];
      const message = choice.message;

      const toolCalls = message.tool_calls?.filter(tc => tc.type === 'function').map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      return {
        content: message.content || '',
        toolCalls,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
        } : undefined,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *stream(messages: LLMMessage[]): AsyncIterable<string> {
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      const stream = await this.client.chat.completions.create({
        model: this.config.model,
        messages: openaiMessages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): LLMError {
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        return new LLMError(
          'Invalid API key. Please check your OpenAI API key in Settings.',
          'INVALID_API_KEY',
          'openai',
          error
        );
      }
      if (error.status === 429) {
        return new LLMError(
          'Rate limit exceeded. Please wait before making more requests.',
          'RATE_LIMIT',
          'openai',
          error
        );
      }
      if (error.status === 404) {
        return new LLMError(
          `Model not found: ${this.config.model}. Please check the model name.`,
          'INVALID_MODEL',
          'openai',
          error
        );
      }
      if (error.message?.includes('context_length_exceeded')) {
        return new LLMError(
          'Context length exceeded. Try reducing the input size.',
          'CONTEXT_LENGTH_EXCEEDED',
          'openai',
          error
        );
      }
      return new LLMError(
        error.message || 'OpenAI API error',
        'PROVIDER_ERROR',
        'openai',
        error
      );
    }

    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('network')) {
        return new LLMError(
          'Network error. Please check your internet connection.',
          'NETWORK_ERROR',
          'openai',
          error
        );
      }
      return new LLMError(error.message, 'PROVIDER_ERROR', 'openai', error);
    }

    return new LLMError('Unknown error occurred', 'PROVIDER_ERROR', 'openai');
  }
}
