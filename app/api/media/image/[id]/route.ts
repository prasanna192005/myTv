import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { type NextRequest } from 'next/server';
import { getConfig } from '@/lib/config';
import { getCachedVideos } from '@/lib/videos';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Lookup item by ID
  const mediaList = getCachedVideos();
  const mediaItem = mediaList.find((v) => v.id === id);
  if (!mediaItem) {
    return new Response('Media item not found', { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const isPosterRequest = searchParams.get('poster') === 'true';

  let relativePathToServe: string | undefined;

  if (isPosterRequest) {
    if (mediaItem.type !== 'video' || !mediaItem.posterPath) {
      return new Response('Poster not found for this media', { status: 404 });
    }
    relativePathToServe = mediaItem.posterPath;
  } else {
    if (mediaItem.type !== 'image') {
      return new Response('Requested item is not an image', { status: 400 });
    }
    relativePathToServe = mediaItem.relativePath;
  }

  // 2. Validate path against configured sandbox
  const config = getConfig();
  const mediaDir = config.mediaDirectory;
  
  if (!mediaDir) {
    return new Response('Media directory not configured', { status: 400 });
  }

  // Construct absolute path and resolve it
  const resolvedPath = path.resolve(path.join(mediaDir, relativePathToServe));
  const resolvedMediaDir = path.resolve(mediaDir);
  
  const lowerPath = resolvedPath.toLowerCase();
  const lowerMediaDir = resolvedMediaDir.toLowerCase();

  const isInside = lowerPath === lowerMediaDir || lowerPath.startsWith(lowerMediaDir + path.sep.toLowerCase());
  
  if (!isInside) {
    return new Response('Access denied: file is outside media directory', { status: 403 });
  }

  // Check if file exists
  if (!existsSync(resolvedPath)) {
    return new Response('Image file not found on disk', { status: 404 });
  }

  try {
    const fileBuffer = readFileSync(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();

    let contentType = 'image/jpeg';
    if (ext === '.png') {
      contentType = 'image/png';
    } else if (ext === '.webp') {
      contentType = 'image/webp';
    } else if (ext === '.gif') {
      contentType = 'image/gif';
    } else if (ext === '.svg') {
      contentType = 'image/svg+xml';
    }

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour to speed up UI loading
      },
    });
  } catch (err: any) {
    return new Response(`Failed to read image: ${err.message}`, { status: 500 });
  }
}
