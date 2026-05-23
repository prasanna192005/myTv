import { type NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { scanVideos } from '@/lib/videos';

export async function GET(request: NextRequest) {
  const config = getConfig();
  const searchParams = request.nextUrl.searchParams;
  const forceRescan = searchParams.get('scan') === 'true';

  try {
    const videos = scanVideos(config.mediaDirectory, forceRescan);
    return NextResponse.json({
      success: true,
      mediaDirectory: config.mediaDirectory,
      videos,
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e.message || 'Failed to scan videos',
    }, { status: 500 });
  }
}
