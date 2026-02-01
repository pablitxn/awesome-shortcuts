import type { LLMConfig } from '@/lib/types';
import { LLMError } from '@/lib/types';
import { BaseLLMClient, LLMMessage, LLMResponse, ToolDefinition } from '../llm-client';

interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OllamaResponse {
  model: string;
  message: OllamaMessage;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

interface OllamaStreamResponse {
  model: string;
  message?: OllamaMessage;
  done: boolean;
  error?: string;
}

export class OllamaClient extends BaseLLMClient {
  private baseUrl: string;

  constructor(config: LLMConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
  }

  async chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const ollamaMessages: OllamaMessage[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Ollama tool support is limited, so we include tool descriptions in the system prompt
    if (tools && tools.length > 0) {
      const toolsDescription = this.formatToolsForPrompt(tools);
      const systemMessageIndex = ollamaMessages.findIndex(m => m.role === 'system');

      if (systemMessageIndex >= 0) {
        ollamaMessages[systemMessageIndex].content += '\n\n' + toolsDescription;
      } else {
        ollamaMessages.unshift({
          role: 'system',
          content: toolsDescription,
        });
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: ollamaMessages,
          stream: false,
          options: {
            temperature: this.config.temperature,
            num_predict: this.config.maxTokens,
          },
        }),
      });

      if (!response.ok) {
        throw await this.handleHttpError(response);
      }

      const data: OllamaResponse = await response.json();

      if (data.error) {
        throw new LLMError(data.error, 'PROVIDER_ERROR', 'ollama');
      }

      // Try to parse tool calls from the response if tools were provided
      const toolCalls = tools ? this.parseToolCalls(data.message.content) : undefined;

      return {
        content: data.message.content,
        toolCalls,
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
        },
      };
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      throw this.handleError(error);
    }
  }

  async *stream(messages: LLMMessage[]): AsyncIterable<string> {
    const ollamaMessages: OllamaMessage[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: ollamaMessages,
          stream: true,
          options: {
            temperature: this.config.temperature,
            num_predict: this.config.maxTokens,
          },
        }),
      });

      if (!response.ok) {
        throw await this.handleHttpError(response);
      }
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      throw this.handleError(error);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new LLMError('No response body', 'PROVIDER_ERROR', 'ollama');
    }

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data: OllamaStreamResponse = JSON.parse(line);
            if (data.error) {
              throw new LLMError(data.error, 'PROVIDER_ERROR', 'ollama');
            }
            if (data.message?.content) {
              yield data.message.content;
            }
          } catch (parseError) {
            if (parseError instanceof LLMError) {
              throw parseError;
            }
            // Skip invalid JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async handleHttpError(response: Response): Promise<LLMError> {
    let errorMessage = `Ollama API error: ${response.status}`;

    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Use default error message
    }

    if (response.status === 404) {
      return new LLMError(
        `Model not found: ${this.config.model}. Make sure Ollama is running and the model is pulled.`,
        'INVALID_MODEL',
        'ollama'
      );
    }

    return new LLMError(errorMessage, 'PROVIDER_ERROR', 'ollama');
  }

  private handleError(error: unknown): LLMError {
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        return new LLMError(
          `Cannot connect to Ollama at ${this.baseUrl}. Make sure Ollama is running.`,
          'NETWORK_ERROR',
          'ollama',
          error
        );
      }
      return new LLMError(error.message, 'PROVIDER_ERROR', 'ollama', error);
    }

    return new LLMError('Unknown error occurred', 'PROVIDER_ERROR', 'ollama');
  }

  private formatToolsForPrompt(tools: ToolDefinition[]): string {
    const toolsList = tools.map(tool => {
      const params = Object.entries(tool.parameters.properties)
        .map(([name, prop]) => `  - ${name}: ${prop.description}`)
        .join('\n');

      return `Tool: ${tool.name}
Description: ${tool.description}
Parameters:
${params}`;
    }).join('\n\n');

    return `You have access to the following tools. To use a tool, respond with a JSON object in this format:
{"tool": "tool_name", "arguments": {"param1": "value1"}}

Available tools:
${toolsList}

If you need to use a tool, respond ONLY with the JSON object. Otherwise, respond normally.`;
  }

  private parseToolCalls(content: string): { id: string; name: string; arguments: Record<string, unknown> }[] | undefined {
    // Try to find JSON tool calls in the response
    const jsonMatch = content.match(/\{[\s\S]*"tool"[\s\S]*\}/);
    if (!jsonMatch) return undefined;

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.tool && parsed.arguments) {
        return [{
          id: `ollama-${Date.now()}`,
          name: parsed.tool,
          arguments: parsed.arguments,
        }];
      }
    } catch {
      // Not valid JSON, no tool call
    }

    return undefined;
  }
}
