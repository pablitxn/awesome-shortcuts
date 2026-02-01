import { NextRequest, NextResponse } from 'next/server';
import { configPaths } from '@/lib/db/queries';
import type { ApiResponse, ConfigPath } from '@/lib/types';
import {
  validateIdParam,
  validateCreateInput,
  isPathAccessible,
  type CreateConfigPathInput,
} from '@/lib/validation/config-paths';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/config-paths/[id] - Get a specific config path
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<ConfigPath>>> {
  try {
    const { id } = await params;
    const validation = validateIdParam(id);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
        },
        { status: 400 }
      );
    }

    const configPath = configPaths.getById(validation.id!);
    if (!configPath) {
      return NextResponse.json(
        {
          success: false,
          error: `Config path with ID ${validation.id} not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: configPath,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch config path: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

// PUT /api/config-paths/[id] - Update a config path
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<ConfigPath>>> {
  try {
    const { id } = await params;
    const validation = validateIdParam(id);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
        },
        { status: 400 }
      );
    }

    // Check if config path exists
    const existing = configPaths.getById(validation.id!);
    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: `Config path with ID ${validation.id} not found`,
        },
        { status: 404 }
      );
    }

    const body = await request.json();

    // For updates, we only allow updating path and enabled
    const updateData: Partial<Pick<ConfigPath, 'path' | 'enabled'>> = {};

    if (body.path !== undefined) {
      if (typeof body.path !== 'string') {
        return NextResponse.json(
          {
            success: false,
            error: 'path must be a string',
          },
          { status: 400 }
        );
      }

      // Validate that the new path exists
      const pathExists = await isPathAccessible(body.path);
      if (!pathExists) {
        return NextResponse.json(
          {
            success: false,
            error: `File not found or not accessible: ${body.path}`,
          },
          { status: 400 }
        );
      }

      updateData.path = body.path;
    }

    if (body.enabled !== undefined) {
      if (typeof body.enabled !== 'boolean') {
        return NextResponse.json(
          {
            success: false,
            error: 'enabled must be a boolean',
          },
          { status: 400 }
        );
      }
      updateData.enabled = body.enabled;
    }

    const updated = configPaths.update(validation.id!, updateData);

    return NextResponse.json({
      success: true,
      data: updated!,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

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
        error: `Failed to update config path: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

// DELETE /api/config-paths/[id] - Remove a config path
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ deleted: boolean }>>> {
  try {
    const { id } = await params;
    const validation = validateIdParam(id);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
        },
        { status: 400 }
      );
    }

    // Check if config path exists
    const existing = configPaths.getById(validation.id!);
    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: `Config path with ID ${validation.id} not found`,
        },
        { status: 404 }
      );
    }

    const deleted = configPaths.delete(validation.id!);

    return NextResponse.json({
      success: true,
      data: { deleted },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: `Failed to delete config path: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
