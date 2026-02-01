import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the database module
vi.mock('@/lib/db/queries', () => ({
  shortcuts: {
    getAll: vi.fn(),
    getByAppId: vi.fn(),
    deleteByAppId: vi.fn(),
    bulkCreate: vi.fn(),
  },
  configPaths: {
    getEnabled: vi.fn(),
  },
}));

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

// Mock parsers
vi.mock('@/lib/parsers/neovim', () => ({
  neovimParser: {
    appId: 'nvim',
    detect: vi.fn(),
    parse: vi.fn(),
    inject: vi.fn(),
  },
}));

vi.mock('@/lib/parsers/tmux', () => ({
  tmuxParser: {
    appId: 'tmux',
    detect: vi.fn(),
    parse: vi.fn(),
    inject: vi.fn(),
  },
}));

vi.mock('@/lib/parsers/zsh', () => ({
  zshParser: {
    appId: 'zsh',
    detect: vi.fn(),
    parse: vi.fn(),
    inject: vi.fn(),
  },
}));

vi.mock('@/lib/parsers/vscode', () => ({
  vscodeParser: {
    appId: 'vscode',
    detect: vi.fn(),
    parse: vi.fn(),
    inject: vi.fn(),
  },
}));

import { GET } from '@/app/api/shortcuts/route';
import { POST } from '@/app/api/shortcuts/refresh/route';
import { shortcuts, configPaths } from '@/lib/db/queries';
import { readFileSync, existsSync } from 'fs';
import { neovimParser } from '@/lib/parsers/neovim';
import { tmuxParser } from '@/lib/parsers/tmux';

describe('Shortcuts API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/shortcuts', () => {
    it('should return all shortcuts when no app_id is provided', async () => {
      const mockShortcuts = [
        {
          id: 1,
          app_id: 'nvim',
          title: 'Save file',
          keys: ['Leader', 'w'],
          description: ':w<CR>',
          source_file: '/mnt/nvim/init.lua',
          source_line: 10,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 2,
          app_id: 'tmux',
          title: 'New window',
          keys: ['Ctrl', 'b', 'c'],
          description: 'Create new window',
          source_file: '/mnt/tmux.conf',
          source_line: 5,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ];

      vi.mocked(shortcuts.getAll).mockReturnValue(mockShortcuts);

      const request = new NextRequest('http://localhost:3000/api/shortcuts');
      const response = await GET(request);
      const data = await response.json();

      expect(shortcuts.getAll).toHaveBeenCalled();
      expect(data.success).toBe(true);
      expect(data.data.shortcuts).toEqual(mockShortcuts);
      expect(data.data.shortcuts).toHaveLength(2);
    });

    it('should filter shortcuts by app_id when provided', async () => {
      const mockShortcuts = [
        {
          id: 1,
          app_id: 'nvim',
          title: 'Save file',
          keys: ['Leader', 'w'],
          description: ':w<CR>',
          source_file: '/mnt/nvim/init.lua',
          source_line: 10,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ];

      vi.mocked(shortcuts.getByAppId).mockReturnValue(mockShortcuts);

      const request = new NextRequest('http://localhost:3000/api/shortcuts?app_id=nvim');
      const response = await GET(request);
      const data = await response.json();

      expect(shortcuts.getByAppId).toHaveBeenCalledWith('nvim');
      expect(shortcuts.getAll).not.toHaveBeenCalled();
      expect(data.success).toBe(true);
      expect(data.data.shortcuts).toEqual(mockShortcuts);
    });

    it('should return empty array when no shortcuts exist', async () => {
      vi.mocked(shortcuts.getAll).mockReturnValue([]);

      const request = new NextRequest('http://localhost:3000/api/shortcuts');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.shortcuts).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(shortcuts.getAll).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const request = new NextRequest('http://localhost:3000/api/shortcuts');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Database connection failed');
    });
  });

  describe('POST /api/shortcuts/refresh', () => {
    it('should return empty result when no config paths are enabled', async () => {
      vi.mocked(configPaths.getEnabled).mockReturnValue([]);

      const response = await POST();
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.parsed).toBe(0);
      expect(data.data.apps).toEqual([]);
    });

    it('should parse config files and update shortcuts', async () => {
      const mockConfigPaths = [
        {
          id: 1,
          app_id: 'nvim',
          path: '/mnt/nvim/init.lua',
          enabled: true,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ];

      const mockParsedShortcuts = [
        {
          title: 'Save file',
          keys: ['Leader', 'w'],
          description: ':w<CR>',
          sourceLine: 10,
        },
        {
          title: 'Quit',
          keys: ['Leader', 'q'],
          description: ':q<CR>',
          sourceLine: 11,
        },
      ];

      vi.mocked(configPaths.getEnabled).mockReturnValue(mockConfigPaths);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('vim.keymap.set content');
      vi.mocked(neovimParser.parse).mockReturnValue(mockParsedShortcuts);

      const response = await POST();
      const data = await response.json();

      expect(configPaths.getEnabled).toHaveBeenCalled();
      expect(existsSync).toHaveBeenCalledWith('/mnt/nvim/init.lua');
      expect(readFileSync).toHaveBeenCalledWith('/mnt/nvim/init.lua', 'utf-8');
      expect(neovimParser.parse).toHaveBeenCalledWith('vim.keymap.set content');
      expect(shortcuts.deleteByAppId).toHaveBeenCalledWith('nvim');
      expect(shortcuts.bulkCreate).toHaveBeenCalledWith([
        {
          app_id: 'nvim',
          title: 'Save file',
          keys: ['Leader', 'w'],
          description: ':w<CR>',
          source_file: '/mnt/nvim/init.lua',
          source_line: 10,
        },
        {
          app_id: 'nvim',
          title: 'Quit',
          keys: ['Leader', 'q'],
          description: ':q<CR>',
          source_file: '/mnt/nvim/init.lua',
          source_line: 11,
        },
      ]);

      expect(data.success).toBe(true);
      expect(data.data.parsed).toBe(2);
      expect(data.data.apps).toContain('nvim');
    });

    it('should handle multiple config paths', async () => {
      const mockConfigPaths = [
        {
          id: 1,
          app_id: 'nvim',
          path: '/mnt/nvim/init.lua',
          enabled: true,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 2,
          app_id: 'tmux',
          path: '/mnt/tmux.conf',
          enabled: true,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ];

      vi.mocked(configPaths.getEnabled).mockReturnValue(mockConfigPaths);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('config content');
      vi.mocked(neovimParser.parse).mockReturnValue([
        { title: 'Save', keys: ['Leader', 'w'], sourceLine: 1 },
      ]);
      vi.mocked(tmuxParser.parse).mockReturnValue([
        { title: 'New window', keys: ['Ctrl', 'b', 'c'], sourceLine: 1 },
        { title: 'Kill pane', keys: ['Ctrl', 'b', 'x'], sourceLine: 2 },
      ]);

      const response = await POST();
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.parsed).toBe(3);
      expect(data.data.apps).toContain('nvim');
      expect(data.data.apps).toContain('tmux');
    });

    it('should report error when config file does not exist', async () => {
      const mockConfigPaths = [
        {
          id: 1,
          app_id: 'nvim',
          path: '/mnt/nvim/init.lua',
          enabled: true,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ];

      vi.mocked(configPaths.getEnabled).mockReturnValue(mockConfigPaths);
      vi.mocked(existsSync).mockReturnValue(false);

      const response = await POST();
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.parsed).toBe(0);
      expect(data.data.errors).toHaveLength(1);
      expect(data.data.errors[0].app_id).toBe('nvim');
      expect(data.data.errors[0].error).toContain('Config file not found');
    });

    it('should report error when no parser is available', async () => {
      const mockConfigPaths = [
        {
          id: 1,
          app_id: 'unknown-app',
          path: '/mnt/unknown/config',
          enabled: true,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ];

      vi.mocked(configPaths.getEnabled).mockReturnValue(mockConfigPaths);

      const response = await POST();
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.parsed).toBe(0);
      expect(data.data.errors).toHaveLength(1);
      expect(data.data.errors[0].error).toContain('No parser available');
    });

    it('should handle parse errors gracefully', async () => {
      const mockConfigPaths = [
        {
          id: 1,
          app_id: 'nvim',
          path: '/mnt/nvim/init.lua',
          enabled: true,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ];

      vi.mocked(configPaths.getEnabled).mockReturnValue(mockConfigPaths);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('invalid content');
      vi.mocked(neovimParser.parse).mockImplementation(() => {
        throw new Error('Parse error: Invalid syntax');
      });

      const response = await POST();
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.parsed).toBe(0);
      expect(data.data.errors).toHaveLength(1);
      expect(data.data.errors[0].error).toContain('Failed to parse');
    });

    it('should continue processing other files when one fails', async () => {
      const mockConfigPaths = [
        {
          id: 1,
          app_id: 'nvim',
          path: '/mnt/nvim/init.lua',
          enabled: true,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 2,
          app_id: 'tmux',
          path: '/mnt/tmux.conf',
          enabled: true,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ];

      vi.mocked(configPaths.getEnabled).mockReturnValue(mockConfigPaths);
      vi.mocked(existsSync).mockImplementation((path) => path === '/mnt/tmux.conf');
      vi.mocked(readFileSync).mockReturnValue('config content');
      vi.mocked(tmuxParser.parse).mockReturnValue([
        { title: 'New window', keys: ['Ctrl', 'b', 'c'], sourceLine: 1 },
      ]);

      const response = await POST();
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.parsed).toBe(1);
      expect(data.data.apps).toContain('tmux');
      expect(data.data.errors).toHaveLength(1);
      expect(data.data.errors[0].app_id).toBe('nvim');
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(configPaths.getEnabled).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Database connection failed');
    });
  });
});
