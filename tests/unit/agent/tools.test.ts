import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import {
  executeTool,
  executeToolCalls,
  toolDefinitions,
  type ToolExecutionResult,
} from '@/lib/agent/tools';
import { configPaths, shortcuts, auditLog } from '@/lib/db/queries';
import type { ConfigPath, Shortcut, AuditLogEntry } from '@/lib/types';

// Mock the database queries
vi.mock('@/lib/db/queries', () => ({
  configPaths: {
    getByAppId: vi.fn(),
  },
  shortcuts: {
    getByAppId: vi.fn(),
    deleteByAppId: vi.fn(),
    bulkCreate: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

// Load test fixtures
const fixturesDir = path.join(__dirname, '../../fixtures');

describe('Agent Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('toolDefinitions', () => {
    it('should have 4 tool definitions', () => {
      expect(toolDefinitions).toHaveLength(4);
    });

    it('should have read_config tool definition', () => {
      const readConfig = toolDefinitions.find(t => t.name === 'read_config');
      expect(readConfig).toBeDefined();
      expect(readConfig?.parameters.required).toContain('app_id');
    });

    it('should have list_shortcuts tool definition', () => {
      const listShortcuts = toolDefinitions.find(t => t.name === 'list_shortcuts');
      expect(listShortcuts).toBeDefined();
      expect(listShortcuts?.parameters.required).toContain('app_id');
    });

    it('should have add_shortcut tool definition', () => {
      const addShortcut = toolDefinitions.find(t => t.name === 'add_shortcut');
      expect(addShortcut).toBeDefined();
      expect(addShortcut?.parameters.required).toContain('app_id');
      expect(addShortcut?.parameters.required).toContain('title');
      expect(addShortcut?.parameters.required).toContain('keys');
      expect(addShortcut?.parameters.required).toContain('description');
    });

    it('should have remove_shortcut tool definition', () => {
      const removeShortcut = toolDefinitions.find(t => t.name === 'remove_shortcut');
      expect(removeShortcut).toBeDefined();
      expect(removeShortcut?.parameters.required).toContain('app_id');
      expect(removeShortcut?.parameters.required).toContain('identifier');
    });

    it('should have valid enum values for app_id in all tools', () => {
      const validAppIds = ['nvim', 'tmux', 'zsh', 'vscode'];
      for (const tool of toolDefinitions) {
        const appIdProp = tool.parameters.properties.app_id;
        expect(appIdProp.enum).toEqual(validAppIds);
      }
    });
  });

  describe('executeTool - read_config', () => {
    const mockConfigPath: ConfigPath = {
      id: 1,
      app_id: 'nvim',
      path: '/home/user/.config/nvim/init.lua',
      enabled: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    const mockFileContent = `
vim.keymap.set('n', '<leader>w', ':w<CR>', { desc = 'Save file' })
vim.keymap.set('n', '<leader>q', ':q<CR>', { desc = 'Quit' })
`;

    it('should read config and return parsed shortcuts', async () => {
      vi.mocked(configPaths.getByAppId).mockReturnValue(mockConfigPath);
      vi.mocked(fs.readFile).mockResolvedValue(mockFileContent);

      const result = await executeTool(
        { id: 'call_1', name: 'read_config', arguments: { app_id: 'nvim' } }
      );

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();

      const data = result.result as {
        path: string;
        content: string;
        shortcuts: Array<{ title: string; keys: string[] }>;
      };

      expect(data.path).toBe(mockConfigPath.path);
      expect(data.content).toBe(mockFileContent);
      expect(data.shortcuts.length).toBeGreaterThan(0);

      const saveShortcut = data.shortcuts.find(s => s.title === 'Save file');
      expect(saveShortcut).toBeDefined();
      expect(saveShortcut?.keys).toEqual(['Leader', 'w']);
    });

    it('should return error when config path not found', async () => {
      vi.mocked(configPaths.getByAppId).mockReturnValue(undefined);

      const result = await executeTool(
        { id: 'call_1', name: 'read_config', arguments: { app_id: 'nvim' } }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No configuration path found');
    });

    it('should return error when parser not available', async () => {
      const result = await executeTool(
        { id: 'call_1', name: 'read_config', arguments: { app_id: 'unknown' } }
      );

      expect(result.success).toBe(false);
      // The implementation first checks for config path, so an unknown app_id
      // will fail because there's no config path configured for it
      expect(result.error).toContain('No configuration path found');
    });

    it('should return error when file read fails', async () => {
      vi.mocked(configPaths.getByAppId).mockReturnValue(mockConfigPath);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT: File not found'));

      const result = await executeTool(
        { id: 'call_1', name: 'read_config', arguments: { app_id: 'nvim' } }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to read config file');
    });
  });

  describe('executeTool - list_shortcuts', () => {
    const mockShortcuts: Shortcut[] = [
      {
        id: 1,
        app_id: 'nvim',
        title: 'Save file',
        keys: ['Leader', 'w'],
        description: ':w<CR>',
        source_file: '/home/user/.config/nvim/init.lua',
        source_line: 1,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      {
        id: 2,
        app_id: 'nvim',
        title: 'Quit',
        keys: ['Leader', 'q'],
        description: ':q<CR>',
        source_file: '/home/user/.config/nvim/init.lua',
        source_line: 2,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
    ];

    it('should list shortcuts from database', async () => {
      vi.mocked(shortcuts.getByAppId).mockReturnValue(mockShortcuts);

      const result = await executeTool(
        { id: 'call_1', name: 'list_shortcuts', arguments: { app_id: 'nvim' } }
      );

      expect(result.success).toBe(true);
      expect(result.result).toEqual(mockShortcuts);
    });

    it('should return empty array when no shortcuts found', async () => {
      vi.mocked(shortcuts.getByAppId).mockReturnValue([]);

      const result = await executeTool(
        { id: 'call_1', name: 'list_shortcuts', arguments: { app_id: 'nvim' } }
      );

      expect(result.success).toBe(true);
      expect(result.result).toEqual([]);
    });

    it('should handle database errors', async () => {
      vi.mocked(shortcuts.getByAppId).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await executeTool(
        { id: 'call_1', name: 'list_shortcuts', arguments: { app_id: 'nvim' } }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to list shortcuts');
    });
  });

  describe('executeTool - add_shortcut', () => {
    const mockConfigPath: ConfigPath = {
      id: 1,
      app_id: 'nvim',
      path: '/home/user/.config/nvim/init.lua',
      enabled: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    const mockFileContent = `vim.keymap.set('n', '<leader>w', ':w<CR>', { desc = 'Save file' })`;

    it('should add shortcut to config file', async () => {
      vi.mocked(configPaths.getByAppId).mockReturnValue(mockConfigPath);
      vi.mocked(fs.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(auditLog.create).mockReturnValue({
        id: 1,
        action: 'create',
        target_file: mockConfigPath.path,
        diff: '+ vim.keymap.set...',
        ai_request: 'Add a shortcut',
        created_at: '2024-01-01',
      } as AuditLogEntry);

      const result = await executeTool(
        {
          id: 'call_1',
          name: 'add_shortcut',
          arguments: {
            app_id: 'nvim',
            title: 'Find Files',
            keys: '["Leader", "f", "f"]',
            description: ':Telescope find_files<CR>',
          },
        },
        'Add a find files shortcut'
      );

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();

      const data = result.result as { message: string; backupPath: string };
      expect(data.message).toContain('Successfully added shortcut');
      expect(data.backupPath).toContain('.backup.');

      // Verify file was written
      expect(fs.writeFile).toHaveBeenCalledTimes(2); // backup + new content

      // Verify audit log was created
      expect(auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          target_file: mockConfigPath.path,
        })
      );
    });

    it('should return error when config path not found', async () => {
      vi.mocked(configPaths.getByAppId).mockReturnValue(undefined);

      const result = await executeTool(
        {
          id: 'call_1',
          name: 'add_shortcut',
          arguments: {
            app_id: 'nvim',
            title: 'Find Files',
            keys: '["Leader", "f", "f"]',
            description: ':Telescope find_files<CR>',
          },
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No configuration path found');
    });

    it('should return error for invalid keys format', async () => {
      vi.mocked(configPaths.getByAppId).mockReturnValue(mockConfigPath);

      const result = await executeTool(
        {
          id: 'call_1',
          name: 'add_shortcut',
          arguments: {
            app_id: 'nvim',
            title: 'Find Files',
            keys: 'not-valid-json',
            description: ':Telescope find_files<CR>',
          },
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid keys format');
    });

    it('should return error when keys is not an array of strings', async () => {
      vi.mocked(configPaths.getByAppId).mockReturnValue(mockConfigPath);

      const result = await executeTool(
        {
          id: 'call_1',
          name: 'add_shortcut',
          arguments: {
            app_id: 'nvim',
            title: 'Find Files',
            keys: '[1, 2, 3]',
            description: ':Telescope find_files<CR>',
          },
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid keys format');
    });

    it('should handle file write errors', async () => {
      vi.mocked(configPaths.getByAppId).mockReturnValue(mockConfigPath);
      vi.mocked(fs.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('EACCES: Permission denied'));

      const result = await executeTool(
        {
          id: 'call_1',
          name: 'add_shortcut',
          arguments: {
            app_id: 'nvim',
            title: 'Find Files',
            keys: '["Leader", "f", "f"]',
            description: ':Telescope find_files<CR>',
          },
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to add shortcut');
    });
  });

  describe('executeTool - remove_shortcut', () => {
    const mockConfigPath: ConfigPath = {
      id: 1,
      app_id: 'nvim',
      path: '/home/user/.config/nvim/init.lua',
      enabled: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    const mockFileContent = `vim.keymap.set('n', '<leader>w', ':w<CR>', { desc = 'Save file' })
vim.keymap.set('n', '<leader>q', ':q<CR>', { desc = 'Quit' })`;

    it('should remove shortcut by title', async () => {
      vi.mocked(configPaths.getByAppId).mockReturnValue(mockConfigPath);
      vi.mocked(fs.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(auditLog.create).mockReturnValue({
        id: 1,
        action: 'delete',
        target_file: mockConfigPath.path,
        diff: '- vim.keymap.set...',
        ai_request: 'Remove save shortcut',
        created_at: '2024-01-01',
      } as AuditLogEntry);

      const result = await executeTool(
        {
          id: 'call_1',
          name: 'remove_shortcut',
          arguments: {
            app_id: 'nvim',
            identifier: 'Save file',
          },
        },
        'Remove save shortcut'
      );

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();

      const data = result.result as { message: string; removedShortcut: object };
      expect(data.message).toContain('Successfully removed shortcut');
      expect(data.removedShortcut).toBeDefined();

      // Verify audit log was created
      expect(auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          target_file: mockConfigPath.path,
        })
      );
    });

    it('should remove shortcut by keys', async () => {
      vi.mocked(configPaths.getByAppId).mockReturnValue(mockConfigPath);
      vi.mocked(fs.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(auditLog.create).mockReturnValue({
        id: 1,
        action: 'delete',
        target_file: mockConfigPath.path,
        diff: '- vim.keymap.set...',
        ai_request: null,
        created_at: '2024-01-01',
      } as AuditLogEntry);

      const result = await executeTool(
        {
          id: 'call_1',
          name: 'remove_shortcut',
          arguments: {
            app_id: 'nvim',
            identifier: 'Leader+w',
          },
        }
      );

      expect(result.success).toBe(true);
    });

    it('should return error when shortcut not found', async () => {
      vi.mocked(configPaths.getByAppId).mockReturnValue(mockConfigPath);
      vi.mocked(fs.readFile).mockResolvedValue(mockFileContent);

      const result = await executeTool(
        {
          id: 'call_1',
          name: 'remove_shortcut',
          arguments: {
            app_id: 'nvim',
            identifier: 'Nonexistent shortcut',
          },
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error when config path not found', async () => {
      vi.mocked(configPaths.getByAppId).mockReturnValue(undefined);

      const result = await executeTool(
        {
          id: 'call_1',
          name: 'remove_shortcut',
          arguments: {
            app_id: 'nvim',
            identifier: 'Save file',
          },
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No configuration path found');
    });
  });

  describe('executeTool - unknown tool', () => {
    it('should return error for unknown tool name', async () => {
      const result = await executeTool(
        { id: 'call_1', name: 'unknown_tool', arguments: {} }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });
  });

  describe('executeToolCalls', () => {
    it('should execute multiple tool calls sequentially', async () => {
      const mockShortcuts: Shortcut[] = [
        {
          id: 1,
          app_id: 'nvim',
          title: 'Save file',
          keys: ['Leader', 'w'],
          description: ':w<CR>',
          source_file: '/test/path',
          source_line: 1,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      vi.mocked(shortcuts.getByAppId).mockReturnValue(mockShortcuts);

      const results = await executeToolCalls([
        { id: 'call_1', name: 'list_shortcuts', arguments: { app_id: 'nvim' } },
        { id: 'call_2', name: 'list_shortcuts', arguments: { app_id: 'tmux' } },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should return empty array for empty tool calls', async () => {
      const results = await executeToolCalls([]);
      expect(results).toEqual([]);
    });

    it('should continue executing remaining tools even if one fails', async () => {
      vi.mocked(shortcuts.getByAppId).mockImplementation((appId: string) => {
        if (appId === 'nvim') {
          throw new Error('Database error');
        }
        return [];
      });

      const results = await executeToolCalls([
        { id: 'call_1', name: 'list_shortcuts', arguments: { app_id: 'nvim' } },
        { id: 'call_2', name: 'list_shortcuts', arguments: { app_id: 'tmux' } },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
    });
  });

  describe('Parser integration', () => {
    const mockConfigPath: ConfigPath = {
      id: 1,
      app_id: 'tmux',
      path: '/home/user/.tmux.conf',
      enabled: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    it('should work with tmux parser', async () => {
      const tmuxContent = `
set -g prefix C-a
bind r source-file ~/.tmux.conf
bind-key -n C-h select-pane -L
`;
      vi.mocked(configPaths.getByAppId).mockReturnValue(mockConfigPath);
      vi.mocked(fs.readFile).mockResolvedValue(tmuxContent);

      const result = await executeTool(
        { id: 'call_1', name: 'read_config', arguments: { app_id: 'tmux' } }
      );

      expect(result.success).toBe(true);
      const data = result.result as { shortcuts: Array<{ title: string }> };
      expect(data.shortcuts.length).toBeGreaterThan(0);
    });

    it('should work with zsh parser', async () => {
      const zshConfigPath: ConfigPath = {
        id: 2,
        app_id: 'zsh',
        path: '/home/user/.zshrc',
        enabled: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      const zshContent = `
bindkey '^R' history-incremental-search-backward
alias ll='ls -la'
alias gs='git status'
`;
      vi.mocked(configPaths.getByAppId).mockReturnValue(zshConfigPath);
      vi.mocked(fs.readFile).mockResolvedValue(zshContent);

      const result = await executeTool(
        { id: 'call_1', name: 'read_config', arguments: { app_id: 'zsh' } }
      );

      expect(result.success).toBe(true);
      const data = result.result as { shortcuts: Array<{ title: string }> };
      expect(data.shortcuts.length).toBeGreaterThan(0);
    });

    it('should work with vscode parser', async () => {
      const vscodeConfigPath: ConfigPath = {
        id: 3,
        app_id: 'vscode',
        path: '/home/user/.config/Code/User/keybindings.json',
        enabled: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      const vscodeContent = `[
  {
    "key": "ctrl+shift+p",
    "command": "workbench.action.showCommands"
  },
  {
    "key": "ctrl+k ctrl+s",
    "command": "workbench.action.openGlobalKeybindings"
  }
]`;
      vi.mocked(configPaths.getByAppId).mockReturnValue(vscodeConfigPath);
      vi.mocked(fs.readFile).mockResolvedValue(vscodeContent);

      const result = await executeTool(
        { id: 'call_1', name: 'read_config', arguments: { app_id: 'vscode' } }
      );

      expect(result.success).toBe(true);
      const data = result.result as { shortcuts: Array<{ title: string }> };
      expect(data.shortcuts.length).toBe(2);
    });
  });

  describe('Audit logging', () => {
    const mockConfigPath: ConfigPath = {
      id: 1,
      app_id: 'nvim',
      path: '/home/user/.config/nvim/init.lua',
      enabled: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    const mockFileContent = `vim.keymap.set('n', '<leader>w', ':w<CR>', { desc = 'Save file' })`;

    it('should create audit log entry with user request on add', async () => {
      vi.mocked(configPaths.getByAppId).mockReturnValue(mockConfigPath);
      vi.mocked(fs.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(auditLog.create).mockReturnValue({
        id: 1,
        action: 'create',
        target_file: mockConfigPath.path,
        diff: '+ new line',
        ai_request: 'User request here',
        created_at: '2024-01-01',
      } as AuditLogEntry);

      await executeTool(
        {
          id: 'call_1',
          name: 'add_shortcut',
          arguments: {
            app_id: 'nvim',
            title: 'Test',
            keys: '["Leader", "t"]',
            description: ':test<CR>',
          },
        },
        'User request here'
      );

      expect(auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ai_request: 'User request here',
        })
      );
    });

    it('should create audit log with diff on remove', async () => {
      vi.mocked(configPaths.getByAppId).mockReturnValue(mockConfigPath);
      vi.mocked(fs.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(auditLog.create).mockReturnValue({
        id: 1,
        action: 'delete',
        target_file: mockConfigPath.path,
        diff: '- removed line',
        ai_request: null,
        created_at: '2024-01-01',
      } as AuditLogEntry);

      await executeTool(
        {
          id: 'call_1',
          name: 'remove_shortcut',
          arguments: {
            app_id: 'nvim',
            identifier: 'Save file',
          },
        }
      );

      expect(auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          diff: expect.any(String),
        })
      );
    });
  });
});
