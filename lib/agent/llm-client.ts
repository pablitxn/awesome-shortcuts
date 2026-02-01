import type { LLMConfig, LLMProvider } from '@/lib/types';
import { LLMError } from '@/lib/types';
import { userPreferences } from '@/lib/db/queries';

export { LLMError };

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

export abstract class BaseLLMClient {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  abstract chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>;
  abstract stream(messages: LLMMessage[]): AsyncIterable<string>;
}

export function getLLMConfig(): LLMConfig {
  const providerStr = userPreferences.get('llm_provider');
  const provider = (providerStr || 'openai') as LLMProvider;
  const model = userPreferences.get('llm_model') || getDefaultModel(provider);
  const apiKey = userPreferences.get('llm_api_key');
  const baseUrl = userPreferences.get('llm_base_url');
  const temperatureStr = userPreferences.get('llm_temperature');
  const maxTokensStr = userPreferences.get('llm_max_tokens');

  return {
    provider,
    model,
    apiKey,
    baseUrl,
    temperature: temperatureStr ? parseFloat(temperatureStr) : 0.7,
    maxTokens: maxTokensStr ? parseInt(maxTokensStr, 10) : 2048,
  };
}

export function validateLLMConfig(config: LLMConfig): void {
  if (!config.provider) {
    throw new LLMError(
      'LLM provider not configured',
      'CONFIGURATION_ERROR',
      'openai'
    );
  }

  if (!['openai', 'anthropic', 'ollama'].includes(config.provider)) {
    throw new LLMError(
      `Unknown provider: ${config.provider}`,
      'CONFIGURATION_ERROR',
      config.provider
    );
  }

  if (config.provider !== 'ollama' && !config.apiKey) {
    throw new LLMError(
      `API key required for ${config.provider}. Please configure it in Settings.`,
      'INVALID_API_KEY',
      config.provider
    );
  }

  if (!config.model) {
    throw new LLMError(
      'Model not specified',
      'INVALID_MODEL',
      config.provider
    );
  }
}

function getDefaultModel(provider: LLMProvider): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-3-5-sonnet-20241022';
    case 'ollama':
      return 'llama3';
    default:
      return 'gpt-4o-mini';
  }
}

export async function createLLMClient(config?: LLMConfig): Promise<BaseLLMClient> {
  const resolvedConfig = config || getLLMConfig();

  validateLLMConfig(resolvedConfig);

  switch (resolvedConfig.provider) {
    case 'openai': {
      const { OpenAIClient } = await import('./providers/openai');
      return new OpenAIClient(resolvedConfig);
    }
    case 'anthropic': {
      const { AnthropicClient } = await import('./providers/anthropic');
      return new AnthropicClient(resolvedConfig);
    }
    case 'ollama': {
      const { OllamaClient } = await import('./providers/ollama');
      return new OllamaClient(resolvedConfig);
    }
    default:
      throw new LLMError(
        `Unknown LLM provider: ${resolvedConfig.provider}`,
        'CONFIGURATION_ERROR',
        resolvedConfig.provider
      );
  }
}
