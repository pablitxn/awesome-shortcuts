import { NextRequest, NextResponse } from 'next/server';
import { configPaths } from '@/lib/db/queries';
import type { ApiResponse, ConfigPath } from '@/lib/types';
import {
  validateCreateInput,
  isPathAccessible,
  type CreateConfigPathInput,
} from '@/lib/validation/config-paths';

// GET /api/config-paths - List all configured paths
export async function GET(): Promise<NextResponse<ApiResponse<{ paths: ConfigPath[] }>>> {
  try {
    const paths = configPaths.getAll();

    return NextResponse.json({
      success: true,
      data: { paths },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch config paths: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

// POST /api/config-paths - Add a new config path
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<ConfigPath>>> {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateCreateInput(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.errors.join('; '),
        },
        { status: 400 }
      );
    }

    const input = body as CreateConfigPathInput;

    // Check if app_id already exists (unique constraint)
    const existing = configPaths.getByAppId(input.app_id);
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: `Config path for '${input.app_id}' already exists. Use PUT to update.`,
        },
        { status: 409 }
      );
    }

    // Validate that the file path exists and is accessible
    const pathExists = await isPathAccessible(input.path);
    if (!pathExists) {
      return NextResponse.json(
        {
          success: false,
          error: `File not found or not accessible: ${input.path}`,
        },
        { status: 400 }
      );
    }

    // Create the config path
    const created = configPaths.create(input.app_id, input.path);

    // If enabled is explicitly false, update it
    if (input.enabled === false) {
      const updated = configPaths.update(created.id, { enabled: false });
      if (updated) {
        return NextResponse.json(
          {
            success: true,
            data: updated,
          },
          { status: 201 }
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: created,
      },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle JSON parse errors
    if (errorMessage.includes('JSON')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: `Failed to create config path: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
