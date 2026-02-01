import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toolDefinitions, executeTool, executeToolCalls } from '@/lib/agent/tools';
import type { ToolCall } from '@/lib/agent/llm-client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { configPaths, shortcuts, auditLog } from '@/lib/db/queries';

// Mock the database module
vi.mock('@/lib/db/queries', () => ({
  configPaths: {
    getByAppId: vi.fn(),
    getAll: vi.fn(() => []),
    getEnabled: vi.fn(() => []),
  },
  shortcuts: {
    getByAppId: vi.fn(() => []),
    deleteByAppId: vi.fn(),
    bulkCreate: vi.fn(),
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  chatMessages: {
    getBySession: vi.fn(() => []),
    create: vi.fn(),
    deleteBySession: vi.fn(),
  },
  userPreferences: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

// Create a temp directory for test files
const testDir = path.join(__dirname, '../fixtures/temp');

describe('Agent Tools', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Ensure temp directory exists
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      const files = await fs.readdir(testDir);
      for (const file of files) {
        await fs.unlink(path.join(testDir, file));
      }
    } catch {
      // Ignore errors
    }
  });

  describe('Tool Definitions', () => {
    it('should have all required tools defined', () => {
      const toolNames = toolDefinitions.map(t => t.name);

      expect(toolNames).toContain('read_config');
      expect(toolNames).toContain('list_shortcuts');
      expect(toolNames).toContain('add_shortcut');
      expect(toolNames).toContain('remove_shortcut');
    });

    it('should have valid parameters for each tool', () => {
      for (const tool of toolDefinitions) {
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.parameters).toBeDefined();
        expect(tool.parameters.type).toBe('object');
        expect(tool.parameters.properties).toBeDefined();
        expect(tool.parameters.required).toBeDefined();
        expect(Array.isArray(tool.parameters.required)).toBe(true);
      }
    });

    it('read_config tool should have correct parameters', () => {
      const readConfig = toolDefinitions.find(t => t.name === 'read_config');

      expect(readConfig).toBeDefined();
      expect(readConfig?.parameters.properties.app_id).toBeDefined();
      expect(readConfig?.parameters.properties.app_id.type).toBe('string');
      expect(readConfig?.parameters.properties.app_id.enum).toEqual(['nvim', 'tmux', 'zsh', 'vscode']);
      expect(readConfig?.parameters.required).toContain('app_id');
    });

    it('add_shortcut tool should have correct parameters', () => {
      const addShortcut = toolDefinitions.find(t => t.name === 'add_shortcut');

      expect(addShortcut).toBeDefined();
      expect(addShortcut?.parameters.properties.app_id).toBeDefined();
      expect(addShortcut?.parameters.properties.title).toBeDefined();
      expect(addShortcut?.parameters.properties.keys).toBeDefined();
      expect(addShortcut?.parameters.properties.description).toBeDefined();
      expect(addShortcut?.parameters.required).toContain('app_id');
      expect(addShortcut?.parameters.required).toContain('title');
      expect(addShortcut?.parameters.required).toContain('keys');
      expect(addShortcut?.parameters.required).toContain('description');
    });
  });

  describe('executeTool - read_config', () => {
    it('should return error when config path not found', async () => {
      vi.mocked(configPaths.getByAppId).mockReturnValue(undefined);

      const toolCall: ToolCall = {
        id: 'test-1',
        name: 'read_config',
        arguments: { app_id: 'nvim' },
      };

      const result = await executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No configuration path found');
    });

    it('should read config file when path exists', async () => {
      const testFile = path.join(testDir, 'init.lua');
      const testContent = `vim.keymap.set('n', '<leader>w', ':w<CR>', { desc = 'Save file' })`;
      await fs.writeFile(testFile, testContent);

      vi.mocked(configPaths.getByAppId).mockReturnValue({
        id: 1,
        app_id: 'nvim',
        path: testFile,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const toolCall: ToolCall = {
        id: 'test-1',
        name: 'read_config',
        arguments: { app_id: 'nvim' },
      };

      const result = await executeTool(toolCall);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      const data = result.result as { path: string; content: string; shortcuts: unknown[] };
      expect(data.path).toBe(testFile);
      expect(data.content).toBe(testContent);
      expect(data.shortcuts).toHaveLength(1);
    });

    it('should return error for non-existent file', async () => {
      vi.mocked(configPaths.getByAppId).mockReturnValue({
        id: 1,
        app_id: 'nvim',
        path: '/non/existent/path.lua',
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const toolCall: ToolCall = {
        id: 'test-1',
        name: 'read_config',
        arguments: { app_id: 'nvim' },
      };

      const result = await executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to read config file');
    });
  });

  describe('executeTool - list_shortcuts', () => {
    it('should return shortcuts from database', async () => {
      const mockShortcuts = [
        {
          id: 1,
          app_id: 'nvim',
          title: 'Save file',
          keys: ['Leader', 'w'],
          description: ':w<CR>',
          source_file: '/path/to/init.lua',
          source_line: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      vi.mocked(shortcuts.getByAppId).mockReturnValue(mockShortcuts);

      const toolCall: ToolCall = {
        id: 'test-1',
        name: 'list_shortcuts',
        arguments: { app_id: 'nvim' },
      };

      const result = await executeTool(toolCall);

      expect(result.success).toBe(true);
      expect(result.result).toEqual(mockShortcuts);
    });

    it('should return empty array when no shortcuts exist', async () => {
      vi.mocked(shortcuts.getByAppId).mockReturnValue([]);

      const toolCall: ToolCall = {
        id: 'test-1',
        name: 'list_shortcuts',
        arguments: { app_id: 'nvim' },
      };

      const result = await executeTool(toolCall);

      expect(result.success).toBe(true);
      expect(result.result).toEqual([]);
    });
  });

  describe('executeTool - add_shortcut', () => {
    it('should add shortcut to config file', async () => {
      const testFile = path.join(testDir, 'add-test.lua');
      const initialContent = `-- Keymaps
vim.keymap.set('n', '<leader>w', ':w<CR>', { desc = 'Save file' })
`;
      await fs.writeFile(testFile, initialContent);

      vi.mocked(configPaths.getByAppId).mockReturnValue({
        id: 1,
        app_id: 'nvim',
        path: testFile,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const toolCall: ToolCall = {
        id: 'test-1',
        name: 'add_shortcut',
        arguments: {
          app_id: 'nvim',
          title: 'Find Files',
          keys: '["Leader", "f", "f"]',
          description: ':Telescope find_files<CR>',
        },
      };

      const result = await executeTool(toolCall, 'Add find files shortcut');

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();

      // Verify the file was modified
      const updatedContent = await fs.readFile(testFile, 'utf-8');
      expect(updatedContent).toContain('<leader>ff');
      expect(updatedContent).toContain('Find Files');

      // Verify audit log was created
      expect(auditLog.create).toHaveBeenCalled();
    });

    it('should return error for invalid keys JSON', async () => {
      vi.mocked(configPaths.getByAppId).mockReturnValue({
        id: 1,
        app_id: 'nvim',
        path: '/some/path.lua',
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const toolCall: ToolCall = {
        id: 'test-1',
        name: 'add_shortcut',
        arguments: {
          app_id: 'nvim',
          title: 'Test',
          keys: 'invalid json',
          description: ':test<CR>',
        },
      };

      const result = await executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid keys format');
    });

    it('should return error when config path not found', async () => {
      vi.mocked(configPaths.getByAppId).mockReturnValue(undefined);

      const toolCall: ToolCall = {
        id: 'test-1',
        name: 'add_shortcut',
        arguments: {
          app_id: 'nvim',
          title: 'Test',
          keys: '["Leader", "t"]',
          description: ':test<CR>',
        },
      };

      const result = await executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No configuration path found');
    });
  });

  describe('executeTool - remove_shortcut', () => {
    it('should remove shortcut from config file', async () => {
      const testFile = path.join(testDir, 'remove-test.lua');
      const initialContent = `-- Keymaps
vim.keymap.set('n', '<leader>w', ':w<CR>', { desc = 'Save file' })
vim.keymap.set('n', '<leader>q', ':q<CR>', { desc = 'Quit' })
`;
      await fs.writeFile(testFile, initialContent);

      vi.mocked(configPaths.getByAppId).mockReturnValue({
        id: 1,
        app_id: 'nvim',
        path: testFile,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const toolCall: ToolCall = {
        id: 'test-1',
        name: 'remove_shortcut',
        arguments: {
          app_id: 'nvim',
          identifier: 'Save file',
        },
      };

      const result = await executeTool(toolCall, 'Remove save shortcut');

      expect(result.success).toBe(true);

      // Verify the file was modified
      const updatedContent = await fs.readFile(testFile, 'utf-8');
      expect(updatedContent).not.toContain('Save file');
      expect(updatedContent).toContain('Quit');

      // Verify audit log was created
      expect(auditLog.create).toHaveBeenCalled();
    });

    it('should return error when shortcut not found', async () => {
      const testFile = path.join(testDir, 'remove-test-2.lua');
      const initialContent = `vim.keymap.set('n', '<leader>w', ':w<CR>', { desc = 'Save file' })`;
      await fs.writeFile(testFile, initialContent);

      vi.mocked(configPaths.getByAppId).mockReturnValue({
        id: 1,
        app_id: 'nvim',
        path: testFile,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const toolCall: ToolCall = {
        id: 'test-1',
        name: 'remove_shortcut',
        arguments: {
          app_id: 'nvim',
          identifier: 'Non-existent shortcut',
        },
      };

      const result = await executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('executeTool - unknown tool', () => {
    it('should return error for unknown tool', async () => {
      const toolCall: ToolCall = {
        id: 'test-1',
        name: 'unknown_tool',
        arguments: {},
      };

      const result = await executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });
  });

  describe('executeToolCalls', () => {
    it('should execute multiple tool calls in sequence', async () => {
      const mockShortcuts = [
        {
          id: 1,
          app_id: 'nvim',
          title: 'Save',
          keys: ['Leader', 'w'],
          description: ':w<CR>',
          source_file: '/path/to/init.lua',
          source_line: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      vi.mocked(shortcuts.getByAppId).mockReturnValue(mockShortcuts);

      const toolCalls: ToolCall[] = [
        {
          id: 'test-1',
          name: 'list_shortcuts',
          arguments: { app_id: 'nvim' },
        },
        {
          id: 'test-2',
          name: 'list_shortcuts',
          arguments: { app_id: 'tmux' },
        },
      ];

      const results = await executeToolCalls(toolCalls);

      expect(results).toHaveLength(2);
      expect(results[0].tool).toBe('list_shortcuts');
      expect(results[1].tool).toBe('list_shortcuts');
    });

    it('should handle mixed success and failure', async () => {
      vi.mocked(shortcuts.getByAppId).mockReturnValue([]);
      vi.mocked(configPaths.getByAppId).mockReturnValue(undefined);

      const toolCalls: ToolCall[] = [
        {
          id: 'test-1',
          name: 'list_shortcuts',
          arguments: { app_id: 'nvim' },
        },
        {
          id: 'test-2',
          name: 'read_config',
          arguments: { app_id: 'nvim' },
        },
      ];

      const results = await executeToolCalls(toolCalls);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });
});
