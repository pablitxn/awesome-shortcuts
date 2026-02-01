import { NextRequest, NextResponse } from 'next/server';
import { configPaths } from '@/lib/db/queries';
import type { ApiResponse, ConfigPath } from '@/lib/types';
import { validateIdParam } from '@/lib/validation/config-paths';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/config-paths/[id]/toggle - Toggle enabled status
export async function PUT(
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

    // Toggle the enabled status
    const updated = configPaths.update(validation.id!, {
      enabled: !existing.enabled,
    });

    return NextResponse.json({
      success: true,
      data: updated!,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: `Failed to toggle config path: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
