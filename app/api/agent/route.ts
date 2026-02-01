import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createLLMClient, getLLMConfig, type LLMMessage } from '@/lib/agent/llm-client';
import { toolDefinitions, executeToolCalls, type ToolExecutionResult } from '@/lib/agent/tools';
import { chatMessages } from '@/lib/db/queries';
import { LLMError } from '@/lib/types';

const SYSTEM_PROMPT = `You are a helpful assistant that helps users manage keyboard shortcuts for their development tools.

You can read configuration files, list shortcuts, and add or remove shortcuts for the following applications:
- nvim (Neovim): Lua and VimScript keymaps
- tmux: Terminal multiplexer bindings
- zsh: Shell aliases and key bindings
- vscode: VS Code keyboard shortcuts

When the user asks you to add a shortcut, always use the add_shortcut tool with the correct parameters:
- app_id: The application (nvim, tmux, zsh, or vscode)
- title: A descriptive name for the shortcut
- keys: A JSON array of key parts (e.g., '["Leader", "w"]' for <leader>w in Neovim)
- description: The command or action (e.g., ":w<CR>" for save in Neovim)

Key notation examples:
- Neovim: ["Leader", "f", "f"] for <leader>ff, ["Ctrl", "s"] for <C-s>
- Tmux: ["Ctrl", "B", "c"] for prefix-c (new window)
- Zsh: ["Ctrl", "R"] for reverse search
- VS Code: ["Ctrl", "Shift", "P"] for command palette

When users ask to view or list shortcuts, use list_shortcuts or read_config first.

Always confirm the action you're about to take before making changes. Be concise and helpful.`;

interface AgentRequest {
  message: string;
  sessionId?: string;
}

interface AgentResponse {
  message: string;
  sessionId: string;
  toolCalls: ToolExecutionResult[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as AgentRequest;
    const { message, sessionId: providedSessionId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Generate or use provided session ID
    const sessionId = providedSessionId || uuidv4();

    // Load chat history from database
    const history = chatMessages.getBySession(sessionId);

    // Build messages array for LLM
    const messages: LLMMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    // Add chat history
    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add the new user message
    messages.push({ role: 'user', content: message });

    // Save user message to database
    chatMessages.create(sessionId, 'user', message);

    // Check if LLM is configured
    const config = getLLMConfig();
    if (!config.apiKey && config.provider !== 'ollama') {
      return NextResponse.json(
        {
          error: 'LLM API key not configured. Please set your API key in the settings.',
          sessionId,
        },
        { status: 400 }
      );
    }

    // Create LLM client
    const client = await createLLMClient(config);

    // Track all tool calls across iterations
    const allToolCalls: ToolExecutionResult[] = [];

    // Allow multiple rounds of tool calling
    const MAX_ITERATIONS = 5;
    let iteration = 0;
    let finalResponse = '';

    while (iteration < MAX_ITERATIONS) {
      iteration++;

      // Call LLM with tools
      const response = await client.chat(messages, toolDefinitions);

      // If no tool calls, we have the final response
      if (!response.toolCalls || response.toolCalls.length === 0) {
        finalResponse = response.content;
        break;
      }

      // Execute tool calls
      const toolResults = await executeToolCalls(response.toolCalls, message);
      allToolCalls.push(...toolResults);

      // Add assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: response.content || `Calling tools: ${response.toolCalls.map(t => t.name).join(', ')}`,
      });

      // Add tool results as user message (for the next LLM call)
      const toolResultsMessage = toolResults
        .map(r => {
          if (r.success) {
            return `Tool ${r.tool} result: ${JSON.stringify(r.result, null, 2)}`;
          } else {
            return `Tool ${r.tool} error: ${r.error}`;
          }
        })
        .join('\n\n');

      messages.push({
        role: 'user',
        content: `Tool execution results:\n${toolResultsMessage}`,
      });

      // If this was the last allowed iteration, get a final response
      if (iteration === MAX_ITERATIONS) {
        const finalCall = await client.chat(messages);
        finalResponse = finalCall.content;
      }
    }

    // Save assistant response to database
    chatMessages.create(sessionId, 'assistant', finalResponse);

    const response: AgentResponse = {
      message: finalResponse,
      sessionId,
      toolCalls: allToolCalls,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('Agent API error:', err);

    if (err instanceof LLMError) {
      return NextResponse.json(
        {
          error: `LLM Error (${err.code}): ${err.message}`,
          provider: err.provider,
        },
        { status: 500 }
      );
    }

    const error = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Agent error: ${error}` },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    message: 'Agent API is running',
    tools: toolDefinitions.map(t => ({ name: t.name, description: t.description })),
  });
}
