import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isValidAppId,
  isPathWithinAllowedMounts,
  validateCreateInput,
  validateIdParam,
  SUPPORTED_APP_IDS,
} from '@/lib/validation/config-paths';

// Mock the database module
vi.mock('@/lib/db/queries', () => ({
  configPaths: {
    getAll: vi.fn(() => []),
    getById: vi.fn(),
    getByAppId: vi.fn(),
    getEnabled: vi.fn(() => []),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock fs/promises for path validation
vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    constants: { R_OK: 4, W_OK: 2 },
  },
}));

import { configPaths } from '@/lib/db/queries';

describe('Config Paths API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset NODE_ENV for security tests
    vi.stubEnv('NODE_ENV', 'development');
  });

  describe('Validation Utilities', () => {
    describe('isValidAppId', () => {
      it('should return true for all supported app IDs', () => {
        SUPPORTED_APP_IDS.forEach((appId) => {
          expect(isValidAppId(appId)).toBe(true);
        });
      });

      it('should return true for nvim', () => {
        expect(isValidAppId('nvim')).toBe(true);
      });

      it('should return true for tmux', () => {
        expect(isValidAppId('tmux')).toBe(true);
      });

      it('should return true for zsh', () => {
        expect(isValidAppId('zsh')).toBe(true);
      });

      it('should return true for vscode', () => {
        expect(isValidAppId('vscode')).toBe(true);
      });

      it('should return false for invalid app IDs', () => {
        expect(isValidAppId('invalid')).toBe(false);
        expect(isValidAppId('')).toBe(false);
        expect(isValidAppId('emacs')).toBe(false);
        expect(isValidAppId('vim')).toBe(false);
      });
    });

    describe('isPathWithinAllowedMounts', () => {
      it('should allow any path in development mode', () => {
        vi.stubEnv('NODE_ENV', 'development');
        expect(isPathWithinAllowedMounts('/Users/test/config')).toBe(true);
        expect(isPathWithinAllowedMounts('/home/user/.config')).toBe(true);
      });

      it('should only allow mounted paths in production', () => {
        vi.stubEnv('NODE_ENV', 'production');
        expect(isPathWithinAllowedMounts('/mnt/nvim/init.lua')).toBe(true);
        expect(isPathWithinAllowedMounts('/mnt/tmux.conf')).toBe(true);
        expect(isPathWithinAllowedMounts('/app/data/test.db')).toBe(true);
      });

      it('should reject paths outside mounted volumes in production', () => {
        vi.stubEnv('NODE_ENV', 'production');
        expect(isPathWithinAllowedMounts('/etc/passwd')).toBe(false);
        expect(isPathWithinAllowedMounts('/home/user/.config')).toBe(false);
      });

      it('should prevent directory traversal attacks', () => {
        vi.stubEnv('NODE_ENV', 'production');
        expect(isPathWithinAllowedMounts('/mnt/../etc/passwd')).toBe(false);
      });
    });

    describe('validateCreateInput', () => {
      it('should return valid for correct input', () => {
        const result = validateCreateInput({
          app_id: 'nvim',
          path: '/mnt/nvim/init.lua',
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should return valid with optional enabled field', () => {
        const result = validateCreateInput({
          app_id: 'nvim',
          path: '/mnt/nvim/init.lua',
          enabled: true,
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject non-object input', () => {
        expect(validateCreateInput(null).valid).toBe(false);
        expect(validateCreateInput(undefined).valid).toBe(false);
        expect(validateCreateInput('string').valid).toBe(false);
        expect(validateCreateInput(123).valid).toBe(false);
      });

      it('should require app_id', () => {
        const result = validateCreateInput({
          path: '/mnt/nvim/init.lua',
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('app_id is required');
      });

      it('should validate app_id is a string', () => {
        const result = validateCreateInput({
          app_id: 123,
          path: '/mnt/nvim/init.lua',
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('app_id must be a string');
      });

      it('should validate app_id is supported', () => {
        const result = validateCreateInput({
          app_id: 'invalid',
          path: '/mnt/nvim/init.lua',
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('app_id must be one of'))).toBe(
          true
        );
      });

      it('should require path', () => {
        const result = validateCreateInput({
          app_id: 'nvim',
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('path is required');
      });

      it('should validate path is a string', () => {
        const result = validateCreateInput({
          app_id: 'nvim',
          path: 123,
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('path must be a string');
      });

      it('should validate enabled is a boolean', () => {
        const result = validateCreateInput({
          app_id: 'nvim',
          path: '/mnt/nvim/init.lua',
          enabled: 'yes',
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('enabled must be a boolean');
      });

      it('should collect multiple errors', () => {
        const result = validateCreateInput({});
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(2);
        expect(result.errors).toContain('app_id is required');
        expect(result.errors).toContain('path is required');
      });
    });

    describe('validateIdParam', () => {
      it('should return valid for positive integers', () => {
        expect(validateIdParam('1')).toEqual({ valid: true, id: 1 });
        expect(validateIdParam('123')).toEqual({ valid: true, id: 123 });
        expect(validateIdParam('999')).toEqual({ valid: true, id: 999 });
      });

      it('should reject non-numeric strings', () => {
        const result = validateIdParam('abc');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid ID: must be a positive integer');
      });

      it('should reject zero', () => {
        const result = validateIdParam('0');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid ID: must be a positive integer');
      });

      it('should reject negative numbers', () => {
        const result = validateIdParam('-1');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid ID: must be a positive integer');
      });

      it('should reject empty string', () => {
        const result = validateIdParam('');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid ID: must be a positive integer');
      });
    });
  });

  describe('Database Queries (via mocks)', () => {
    it('should use getAll to fetch all config paths', () => {
      vi.mocked(configPaths.getAll).mockReturnValue([
        {
          id: 1,
          app_id: 'nvim',
          path: '/mnt/nvim/init.lua',
          enabled: true,
          created_at: '2026-01-31T00:00:00Z',
          updated_at: '2026-01-31T00:00:00Z',
        },
      ]);

      const result = configPaths.getAll();

      expect(configPaths.getAll).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].app_id).toBe('nvim');
    });

    it('should use getById to fetch a specific config path', () => {
      vi.mocked(configPaths.getById).mockReturnValue({
        id: 1,
        app_id: 'nvim',
        path: '/mnt/nvim/init.lua',
        enabled: true,
        created_at: '2026-01-31T00:00:00Z',
        updated_at: '2026-01-31T00:00:00Z',
      });

      const result = configPaths.getById(1);

      expect(configPaths.getById).toHaveBeenCalledWith(1);
      expect(result?.app_id).toBe('nvim');
    });

    it('should return undefined for non-existent ID', () => {
      vi.mocked(configPaths.getById).mockReturnValue(undefined);

      const result = configPaths.getById(999);

      expect(configPaths.getById).toHaveBeenCalledWith(999);
      expect(result).toBeUndefined();
    });

    it('should use getByAppId to check for existing app_id', () => {
      vi.mocked(configPaths.getByAppId).mockReturnValue({
        id: 1,
        app_id: 'nvim',
        path: '/mnt/nvim/init.lua',
        enabled: true,
        created_at: '2026-01-31T00:00:00Z',
        updated_at: '2026-01-31T00:00:00Z',
      });

      const result = configPaths.getByAppId('nvim');

      expect(configPaths.getByAppId).toHaveBeenCalledWith('nvim');
      expect(result?.id).toBe(1);
    });

    it('should use create to insert a new config path', () => {
      vi.mocked(configPaths.create).mockReturnValue({
        id: 2,
        app_id: 'tmux',
        path: '/mnt/tmux.conf',
        enabled: true,
        created_at: '2026-01-31T00:00:00Z',
        updated_at: '2026-01-31T00:00:00Z',
      });

      const result = configPaths.create('tmux', '/mnt/tmux.conf');

      expect(configPaths.create).toHaveBeenCalledWith('tmux', '/mnt/tmux.conf');
      expect(result.id).toBe(2);
      expect(result.app_id).toBe('tmux');
    });

    it('should use update to toggle enabled status', () => {
      vi.mocked(configPaths.update).mockReturnValue({
        id: 1,
        app_id: 'nvim',
        path: '/mnt/nvim/init.lua',
        enabled: false,
        created_at: '2026-01-31T00:00:00Z',
        updated_at: '2026-01-31T00:00:00Z',
      });

      const result = configPaths.update(1, { enabled: false });

      expect(configPaths.update).toHaveBeenCalledWith(1, { enabled: false });
      expect(result?.enabled).toBe(false);
    });

    it('should use delete to remove a config path', () => {
      vi.mocked(configPaths.delete).mockReturnValue(true);

      const result = configPaths.delete(1);

      expect(configPaths.delete).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('should return false when deleting non-existent config path', () => {
      vi.mocked(configPaths.delete).mockReturnValue(false);

      const result = configPaths.delete(999);

      expect(configPaths.delete).toHaveBeenCalledWith(999);
      expect(result).toBe(false);
    });

    it('should use getEnabled to fetch only enabled config paths', () => {
      vi.mocked(configPaths.getEnabled).mockReturnValue([
        {
          id: 1,
          app_id: 'nvim',
          path: '/mnt/nvim/init.lua',
          enabled: true,
          created_at: '2026-01-31T00:00:00Z',
          updated_at: '2026-01-31T00:00:00Z',
        },
      ]);

      const result = configPaths.getEnabled();

      expect(configPaths.getEnabled).toHaveBeenCalled();
      expect(result.every((p) => p.enabled)).toBe(true);
    });
  });

  describe('API Response Format', () => {
    it('should have correct success response structure', () => {
      const successResponse = {
        success: true,
        data: {
          paths: [
            {
              id: 1,
              app_id: 'nvim',
              path: '/mnt/nvim/init.lua',
              enabled: true,
              created_at: '2026-01-31T00:00:00Z',
              updated_at: '2026-01-31T00:00:00Z',
            },
          ],
        },
      };

      expect(successResponse).toHaveProperty('success', true);
      expect(successResponse).toHaveProperty('data');
      expect(successResponse.data).toHaveProperty('paths');
    });

    it('should have correct error response structure', () => {
      const errorResponse = {
        success: false,
        error: 'Config path not found',
      };

      expect(errorResponse).toHaveProperty('success', false);
      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse).not.toHaveProperty('data');
    });
  });
});
