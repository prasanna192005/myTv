import { NextResponse } from 'next/server';
import { remoteStore, PlayerState } from '@/lib/remote-store';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // If id is 'active', return the state of the active player session
  let targetId = id;
  if (id === 'active') {
    targetId = remoteStore.activeId || '';
  }

  const state = remoteStore.states[targetId];
  const noCacheHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  if (!state) {
    return NextResponse.json({ active: false }, { headers: noCacheHeaders });
  }

  // Check if state is stale (longer than 5 seconds ago)
  const isStale = Date.now() - state.lastUpdated > 5000;
  if (isStale) {
    return NextResponse.json({ active: false }, { headers: noCacheHeaders });
  }

  return NextResponse.json({ active: true, videoId: targetId, state }, { headers: noCacheHeaders });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const {
      playing,
      currentTime,
      duration,
      volume,
      muted,
      videoName,
      hasSubtitles,
      subtitlesVisible,
      mediaType,
    } = body;

    const newState: PlayerState = {
      playing: !!playing,
      currentTime: Number(currentTime || 0),
      duration: Number(duration || 0),
      volume: Number(volume ?? 1),
      muted: !!muted,
      videoName: String(videoName || 'Unknown'),
      lastUpdated: Date.now(),
      hasSubtitles: !!hasSubtitles,
      subtitlesVisible: !!subtitlesVisible,
      mediaType: mediaType || 'video',
    };

    remoteStore.states[id] = newState;
    remoteStore.activeId = id; // Track this as the active session

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 });
  }
}
