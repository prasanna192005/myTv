import { statSync, createReadStream } from 'fs';
import path from 'path';
import { type NextRequest } from 'next/server';
import { Readable } from 'stream';
import { getConfig } from '@/lib/config';
import { getCachedVideos } from '@/lib/videos';

// Force route to be fully dynamic (prevents Next.js buffering/caching the stream)
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // 1. Lookup video by ID from the cached video list
  const videos = getCachedVideos();
  const video = videos.find((v) => v.id === id);
  if (!video) {
    return new Response('Video not found in cache. Please rescan library.', { status: 404 });
  }

  // 2. Validate path (security check - must be within configured directory)
  const config = getConfig();
  const mediaDir = config.mediaDirectory;
  
  if (!mediaDir) {
    return new Response('Media directory not configured', { status: 400 });
  }

  // Construct absolute path and resolve it
  const resolvedPath = path.resolve(path.join(mediaDir, video.relativePath));
  const resolvedMediaDir = path.resolve(mediaDir);
  
  const lowerPath = resolvedPath.toLowerCase();
  const lowerMediaDir = resolvedMediaDir.toLowerCase();

  const isInside = lowerPath === lowerMediaDir || lowerPath.startsWith(lowerMediaDir + path.sep.toLowerCase());
  
  if (!isInside) {
    return new Response('Access denied: file is outside media directory', { status: 403 });
  }

  // Check if file exists
  let stats;
  try {
    stats = statSync(resolvedPath);
  } catch (err) {
    return new Response('Video file not found', { status: 404 });
  }

  if (!stats.isFile()) {
    return new Response('Path is not a file', { status: 400 });
  }

  const range = request.headers.get('range');
  const fileSize = stats.size;
  
  // Get content type
  const ext = path.extname(resolvedPath).toLowerCase();
  let contentType = 'video/mp4';
  if (ext === '.mkv') contentType = 'video/x-matroska';
  else if (ext === '.webm') contentType = 'video/webm';
  else if (ext === '.mov') contentType = 'video/quicktime';
  else if (ext === '.avi') contentType = 'video/x-msvideo';

  // Common response headers to prevent caching issues (critical for incognito seeking)
  const cacheHeaders = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  if (range) {
    // Parse range e.g. "bytes=32324-" or "bytes=32324-45343"
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    
    // Chunk size safety
    if (start >= fileSize || end >= fileSize) {
      return new Response('', {
        status: 416,
        headers: {
          'Content-Range': `bytes */${fileSize}`,
          ...cacheHeaders,
        }
      });
    }

    const chunksize = (end - start) + 1;
    const fileStream = createReadStream(resolvedPath, { start, end });
    const webStream = Readable.toWeb(fileStream);

    return new Response(webStream, {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize.toString(),
        'Content-Type': contentType,
        ...cacheHeaders,
      }
    });
  } else {
    const fileStream = createReadStream(resolvedPath);
    const webStream = Readable.toWeb(fileStream);

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Length': fileSize.toString(),
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        ...cacheHeaders,
      }
    });
  }
}
