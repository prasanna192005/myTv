import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { type NextRequest } from 'next/server';
import { getConfig } from '@/lib/config';
import { getCachedVideos } from '@/lib/videos';

export const dynamic = 'force-dynamic';

function srtToVtt(srtContent: string): string {
  // Convert Windows CRLF line endings to UNIX LF
  let content = srtContent.replace(/\r\n/g, '\n');
  
  // Convert SRT timestamp commas to WebVTT dots (e.g. 00:01:23,456 --> 00:01:23.456)
  content = content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  
  return `WEBVTT\n\n${content}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Lookup video by ID from cached list
  const videos = getCachedVideos();
  const video = videos.find((v) => v.id === id);
  if (!video || !video.subtitlePath) {
    return new Response('Subtitles not found for this video', { status: 404 });
  }

  // 2. Validate path (security check - must be within configured directory)
  const config = getConfig();
  const mediaDir = config.mediaDirectory;
  
  if (!mediaDir) {
    return new Response('Media directory not configured', { status: 400 });
  }

  // Construct absolute path and resolve it
  const resolvedPath = path.resolve(path.join(mediaDir, video.subtitlePath));
  const resolvedMediaDir = path.resolve(mediaDir);
  
  const lowerPath = resolvedPath.toLowerCase();
  const lowerMediaDir = resolvedMediaDir.toLowerCase();

  const isInside = lowerPath === lowerMediaDir || lowerPath.startsWith(lowerMediaDir + path.sep.toLowerCase());
  
  if (!isInside) {
    return new Response('Access denied: subtitle file is outside media directory', { status: 403 });
  }

  // Check if file exists
  if (!existsSync(resolvedPath)) {
    return new Response('Subtitle file not found', { status: 404 });
  }

  try {
    const fileContent = readFileSync(resolvedPath, 'utf8');
    const ext = path.extname(resolvedPath).toLowerCase();

    let vttContent = '';
    if (ext === '.vtt') {
      vttContent = fileContent;
    } else if (ext === '.srt') {
      vttContent = srtToVtt(fileContent);
    } else {
      return new Response('Unsupported subtitle format', { status: 400 });
    }

    return new Response(vttContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: any) {
    return new Response(`Failed to read subtitles: ${err.message}`, { status: 500 });
  }
}
