import { NextResponse } from 'next/server';
import db from '@/lib/db/client';

export async function GET() {
  try {
    // Check DB connection
    db.prepare('SELECT 1').get();

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: errorMessage
    }, { status: 500 });
  }
}
