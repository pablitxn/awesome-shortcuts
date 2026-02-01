import fs from 'fs/promises';
import path from 'path';

// Supported application IDs
export const SUPPORTED_APP_IDS = ['nvim', 'tmux', 'zsh', 'vscode'] as const;
export type SupportedAppId = (typeof SUPPORTED_APP_IDS)[number];

// Allowed mount points for security (prevent directory traversal)
const ALLOWED_MOUNT_PREFIXES = ['/mnt/', '/app/data/'];

export function isValidAppId(appId: string): appId is SupportedAppId {
  return SUPPORTED_APP_IDS.includes(appId as SupportedAppId);
}

export async function isPathAccessible(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function isPathWritable(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function isPathWithinAllowedMounts(filePath: string): boolean {
  // In development, allow absolute paths
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // Normalize path to resolve .. and . segments (prevents directory traversal)
  const normalizedPath = path.resolve('/', filePath);

  // In production, restrict to mounted volumes
  return ALLOWED_MOUNT_PREFIXES.some(prefix => normalizedPath.startsWith(prefix));
}

export interface CreateConfigPathInput {
  app_id: string;
  path: string;
  enabled?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCreateInput(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  const data = input as Record<string, unknown>;

  // Validate app_id
  if (!data.app_id) {
    errors.push('app_id is required');
  } else if (typeof data.app_id !== 'string') {
    errors.push('app_id must be a string');
  } else if (!isValidAppId(data.app_id)) {
    errors.push(`app_id must be one of: ${SUPPORTED_APP_IDS.join(', ')}`);
  }

  // Validate path
  if (!data.path) {
    errors.push('path is required');
  } else if (typeof data.path !== 'string') {
    errors.push('path must be a string');
  } else if (!isPathWithinAllowedMounts(data.path)) {
    errors.push('path must be within allowed mount points');
  }

  // Validate enabled (optional)
  if (data.enabled !== undefined && typeof data.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateIdParam(id: string): { valid: boolean; id?: number; error?: string } {
  const parsedId = parseInt(id, 10);

  if (isNaN(parsedId) || parsedId <= 0) {
    return { valid: false, error: 'Invalid ID: must be a positive integer' };
  }

  return { valid: true, id: parsedId };
}
