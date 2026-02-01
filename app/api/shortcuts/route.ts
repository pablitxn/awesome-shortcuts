import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { shortcuts } from '@/lib/db/queries';
import type { Shortcut, ApiResponse } from '@/lib/types';

interface ShortcutsResponse {
  shortcuts: Shortcut[];
}

/**
 * GET /api/shortcuts
 * Returns all shortcuts from SQLite cache.
 *
 * Query params:
 * - app_id (optional): Filter by app (e.g., 'nvim', 'tmux', 'zsh', 'vscode')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('app_id');

    const data = appId
      ? shortcuts.getByAppId(appId)
      : shortcuts.getAll();

    const response: ApiResponse<ShortcutsResponse> = {
      success: true,
      data: {
        shortcuts: data,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    const response: ApiResponse<ShortcutsResponse> = {
      success: false,
      error: errorMessage,
    };

    return NextResponse.json(response, { status: 500 });
  }
}
