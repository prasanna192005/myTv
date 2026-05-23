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
  if (!state) {
    return NextResponse.json({ active: false });
  }

  // Check if state is stale (longer than 5 seconds ago)
  const isStale = Date.now() - state.lastUpdated > 5000;
  if (isStale) {
    return NextResponse.json({ active: false });
  }

  return NextResponse.json({ active: true, videoId: targetId, state });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { playing, currentTime, duration, volume, muted, videoName } = body;

    const newState: PlayerState = {
      playing: !!playing,
      currentTime: Number(currentTime || 0),
      duration: Number(duration || 0),
      volume: Number(volume ?? 1),
      muted: !!muted,
      videoName: String(videoName || 'Unknown'),
      lastUpdated: Date.now(),
    };

    remoteStore.states[id] = newState;
    remoteStore.activeId = id; // Track this as the active session

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 });
  }
}
