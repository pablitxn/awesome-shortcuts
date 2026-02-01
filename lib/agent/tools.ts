import fs from 'fs/promises';
import path from 'path';
import type { ParsedShortcut, ConfigParser } from '@/lib/types';
import { configPaths, shortcuts, auditLog } from '@/lib/db/queries';
import neovimParser from '@/lib/parsers/neovim';
import tmuxParser from '@/lib/parsers/tmux';
import zshParser from '@/lib/parsers/zsh';
import vscodeParser from '@/lib/parsers/vscode';
import type { ToolDefinition, ToolCall } from './llm-client';

const parsers: Record<string, ConfigParser> = {
  nvim: neovimParser,
  tmux: tmuxParser,
  zsh: zshParser,
  vscode: vscodeParser,
};

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ToolExecutionResult {
  tool: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'read_config',
    description: 'Read the content of a configuration file for a specific application. Returns the file path, content, and parsed shortcuts.',
    parameters: {
      type: 'object',
      properties: {
        app_id: {
          type: 'string',
          description: 'The application ID (e.g., "nvim", "tmux", "zsh", "vscode")',
          enum: ['nvim', 'tmux', 'zsh', 'vscode'],
        },
      },
      required: ['app_id'],
    },
  },
  {
    name: 'list_shortcuts',
    description: 'List all shortcuts for a specific application from the database cache.',
    parameters: {
      type: 'object',
      properties: {
        app_id: {
          type: 'string',
          description: 'The application ID (e.g., "nvim", "tmux", "zsh", "vscode")',
          enum: ['nvim', 'tmux', 'zsh', 'vscode'],
        },
      },
      required: ['app_id'],
    },
  },
  {
    name: 'add_shortcut',
    description: 'Add a new keyboard shortcut to a configuration file. The shortcut will be injected into the appropriate location in the file.',
    parameters: {
      type: 'object',
      properties: {
        app_id: {
          type: 'string',
          description: 'The application ID (e.g., "nvim", "tmux", "zsh", "vscode")',
          enum: ['nvim', 'tmux', 'zsh', 'vscode'],
        },
        title: {
          type: 'string',
          description: 'A descriptive title for the shortcut (e.g., "Save all buffers")',
        },
        keys: {
          type: 'string',
          description: 'The key combination as a JSON array (e.g., \'["Leader", "w", "a"]\' or \'["Ctrl", "s"]\')',
        },
        description: {
          type: 'string',
          description: 'The command or action the shortcut performs (e.g., ":wa<CR>" for Neovim)',
        },
      },
      required: ['app_id', 'title', 'keys', 'description'],
    },
  },
  {
    name: 'remove_shortcut',
    description: 'Remove a shortcut from a configuration file by its title or key combination.',
    parameters: {
      type: 'object',
      properties: {
        app_id: {
          type: 'string',
          description: 'The application ID (e.g., "nvim", "tmux", "zsh", "vscode")',
          enum: ['nvim', 'tmux', 'zsh', 'vscode'],
        },
        identifier: {
          type: 'string',
          description: 'The title or key combination of the shortcut to remove',
        },
      },
      required: ['app_id', 'identifier'],
    },
  },
];

async function readConfig(appId: string): Promise<ToolResult> {
  const configPath = configPaths.getByAppId(appId);
  if (!configPath) {
    return {
      success: false,
      error: `No configuration path found for app "${appId}". Please configure the path in settings.`,
    };
  }

  const parser = parsers[appId];
  if (!parser) {
    return {
      success: false,
      error: `No parser available for app "${appId}"`,
    };
  }

  try {
    const content = await fs.readFile(configPath.path, 'utf-8');
    const parsedShortcuts = parser.parse(content);

    return {
      success: true,
      data: {
        path: configPath.path,
        content,
        shortcuts: parsedShortcuts,
      },
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to read config file: ${error}`,
    };
  }
}

async function listShortcuts(appId: string): Promise<ToolResult> {
  try {
    const appShortcuts = shortcuts.getByAppId(appId);
    return {
      success: true,
      data: appShortcuts,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to list shortcuts: ${error}`,
    };
  }
}

async function addShortcut(
  appId: string,
  title: string,
  keysJson: string,
  description: string,
  userRequest?: string
): Promise<ToolResult> {
  const configPath = configPaths.getByAppId(appId);
  if (!configPath) {
    return {
      success: false,
      error: `No configuration path found for app "${appId}". Please configure the path in settings.`,
    };
  }

  const parser = parsers[appId];
  if (!parser) {
    return {
      success: false,
      error: `No parser available for app "${appId}"`,
    };
  }

  let keys: string[];
  try {
    keys = JSON.parse(keysJson);
    if (!Array.isArray(keys) || !keys.every(k => typeof k === 'string')) {
      throw new Error('Keys must be an array of strings');
    }
  } catch {
    return {
      success: false,
      error: `Invalid keys format. Expected JSON array of strings, got: ${keysJson}`,
    };
  }

  try {
    // Read current content
    const content = await fs.readFile(configPath.path, 'utf-8');

    // Create the shortcut object
    const shortcut: ParsedShortcut = {
      title,
      keys,
      description,
    };

    // Inject the shortcut using the parser
    const newContent = parser.inject(content, shortcut);

    // Create a backup
    const backupPath = `${configPath.path}.backup.${Date.now()}`;
    await fs.writeFile(backupPath, content, 'utf-8');

    // Write the new content
    await fs.writeFile(configPath.path, newContent, 'utf-8');

    // Create audit log entry
    const diff = createDiff(content, newContent);
    auditLog.create({
      action: 'create',
      target_file: configPath.path,
      diff,
      ai_request: userRequest,
    });

    // Update the database cache
    const parsedShortcuts = parser.parse(newContent);
    shortcuts.deleteByAppId(appId);
    shortcuts.bulkCreate(
      parsedShortcuts.map(s => ({
        app_id: appId,
        title: s.title,
        keys: s.keys,
        description: s.description,
        source_file: configPath.path,
        source_line: s.sourceLine,
      }))
    );

    return {
      success: true,
      data: {
        shortcut,
        backupPath,
        message: `Successfully added shortcut "${title}" to ${path.basename(configPath.path)}`,
      },
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to add shortcut: ${error}`,
    };
  }
}

async function removeShortcut(
  appId: string,
  identifier: string,
  userRequest?: string
): Promise<ToolResult> {
  const configPath = configPaths.getByAppId(appId);
  if (!configPath) {
    return {
      success: false,
      error: `No configuration path found for app "${appId}". Please configure the path in settings.`,
    };
  }

  const parser = parsers[appId];
  if (!parser) {
    return {
      success: false,
      error: `No parser available for app "${appId}"`,
    };
  }

  try {
    // Read current content
    const content = await fs.readFile(configPath.path, 'utf-8');
    const lines = content.split('\n');

    // Find the shortcut to remove by parsing the file
    const parsedShortcuts = parser.parse(content);
    const shortcutToRemove = parsedShortcuts.find(
      s => s.title === identifier || s.keys.join('+') === identifier
    );

    if (!shortcutToRemove || !shortcutToRemove.sourceLine) {
      return {
        success: false,
        error: `Shortcut "${identifier}" not found in ${path.basename(configPath.path)}`,
      };
    }

    // Remove the line containing the shortcut
    const lineIndex = shortcutToRemove.sourceLine - 1;

    // Also remove the preceding comment line if it exists and matches the title
    let startLine = lineIndex;
    if (lineIndex > 0) {
      const prevLine = lines[lineIndex - 1].trim();
      if (prevLine.startsWith('#') || prevLine.startsWith('--') || prevLine.startsWith('//')) {
        startLine = lineIndex - 1;
      }
    }

    lines.splice(startLine, lineIndex - startLine + 1);
    const newContent = lines.join('\n');

    // Create a backup
    const backupPath = `${configPath.path}.backup.${Date.now()}`;
    await fs.writeFile(backupPath, content, 'utf-8');

    // Write the new content
    await fs.writeFile(configPath.path, newContent, 'utf-8');

    // Create audit log entry
    const diff = createDiff(content, newContent);
    auditLog.create({
      action: 'delete',
      target_file: configPath.path,
      diff,
      ai_request: userRequest,
    });

    // Update the database cache
    const newParsedShortcuts = parser.parse(newContent);
    shortcuts.deleteByAppId(appId);
    shortcuts.bulkCreate(
      newParsedShortcuts.map(s => ({
        app_id: appId,
        title: s.title,
        keys: s.keys,
        description: s.description,
        source_file: configPath.path,
        source_line: s.sourceLine,
      }))
    );

    return {
      success: true,
      data: {
        removedShortcut: shortcutToRemove,
        backupPath,
        message: `Successfully removed shortcut "${identifier}" from ${path.basename(configPath.path)}`,
      },
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to remove shortcut: ${error}`,
    };
  }
}

function createDiff(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  const diffs: string[] = [];

  // Simple diff: show added and removed lines
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  for (const line of oldLines) {
    if (!newSet.has(line)) {
      diffs.push(`- ${line}`);
    }
  }

  for (const line of newLines) {
    if (!oldSet.has(line)) {
      diffs.push(`+ ${line}`);
    }
  }

  return diffs.join('\n');
}

export async function executeTool(
  toolCall: ToolCall,
  userRequest?: string
): Promise<ToolExecutionResult> {
  const { name, arguments: args } = toolCall;

  try {
    let result: ToolResult;

    switch (name) {
      case 'read_config':
        result = await readConfig(args.app_id as string);
        break;
      case 'list_shortcuts':
        result = await listShortcuts(args.app_id as string);
        break;
      case 'add_shortcut':
        result = await addShortcut(
          args.app_id as string,
          args.title as string,
          args.keys as string,
          args.description as string,
          userRequest
        );
        break;
      case 'remove_shortcut':
        result = await removeShortcut(
          args.app_id as string,
          args.identifier as string,
          userRequest
        );
        break;
      default:
        result = {
          success: false,
          error: `Unknown tool: ${name}`,
        };
    }

    return {
      tool: name,
      success: result.success,
      result: result.data,
      error: result.error,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return {
      tool: name,
      success: false,
      error: `Tool execution failed: ${error}`,
    };
  }
}

export async function executeToolCalls(
  toolCalls: ToolCall[],
  userRequest?: string
): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = [];

  for (const toolCall of toolCalls) {
    const result = await executeTool(toolCall, userRequest);
    results.push(result);
  }

  return results;
}
