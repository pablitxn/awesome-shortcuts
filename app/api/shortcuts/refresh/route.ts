import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { configPaths, shortcuts } from '@/lib/db/queries';
import { neovimParser } from '@/lib/parsers/neovim';
import { tmuxParser } from '@/lib/parsers/tmux';
import { zshParser } from '@/lib/parsers/zsh';
import { vscodeParser } from '@/lib/parsers/vscode';
import type { ConfigParser, ApiResponse } from '@/lib/types';

interface RefreshResponse {
  success: boolean;
  parsed: number;
  apps: string[];
  errors?: Array<{ app_id: string; error: string }>;
}

// All available parsers
const parsers: ConfigParser[] = [
  neovimParser,
  tmuxParser,
  zshParser,
  vscodeParser,
];

/**
 * Find the parser for a given app_id
 */
function getParserForApp(appId: string): ConfigParser | undefined {
  return parsers.find((p) => p.appId === appId);
}

/**
 * POST /api/shortcuts/refresh
 * Re-parses all config files and updates the cache.
 */
export async function POST() {
  try {
    const enabledPaths = configPaths.getEnabled();

    if (enabledPaths.length === 0) {
      const response: ApiResponse<RefreshResponse> = {
        success: true,
        data: {
          success: true,
          parsed: 0,
          apps: [],
        },
      };
      return NextResponse.json(response);
    }

    let totalParsed = 0;
    const parsedApps: string[] = [];
    const errors: Array<{ app_id: string; error: string }> = [];

    for (const configPath of enabledPaths) {
      const { app_id, path } = configPath;

      // Find parser for this app
      const parser = getParserForApp(app_id);
      if (!parser) {
        errors.push({
          app_id,
          error: `No parser available for app: ${app_id}`,
        });
        continue;
      }

      // Check if file exists
      if (!existsSync(path)) {
        errors.push({
          app_id,
          error: `Config file not found: ${path}`,
        });
        continue;
      }

      try {
        // Read and parse the config file
        const content = readFileSync(path, 'utf-8');
        const parsedShortcuts = parser.parse(content);

        // Delete existing shortcuts for this app
        shortcuts.deleteByAppId(app_id);

        // Insert new shortcuts
        if (parsedShortcuts.length > 0) {
          shortcuts.bulkCreate(
            parsedShortcuts.map((shortcut) => ({
              app_id,
              title: shortcut.title,
              keys: shortcut.keys,
              description: shortcut.description,
              source_file: path,
              source_line: shortcut.sourceLine,
            }))
          );
        }

        totalParsed += parsedShortcuts.length;
        parsedApps.push(app_id);
      } catch (parseError) {
        const errorMessage =
          parseError instanceof Error ? parseError.message : 'Unknown parse error';
        errors.push({
          app_id,
          error: `Failed to parse: ${errorMessage}`,
        });
      }
    }

    const response: ApiResponse<RefreshResponse> = {
      success: true,
      data: {
        success: errors.length === 0,
        parsed: totalParsed,
        apps: parsedApps,
        ...(errors.length > 0 && { errors }),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    const response: ApiResponse<RefreshResponse> = {
      success: false,
      error: errorMessage,
    };

    return NextResponse.json(response, { status: 500 });
  }
}
