import { NextResponse } from 'next/server';
import { remoteStore } from '@/lib/remote-store';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  if (!remoteStore.webrtcSignals) {
    remoteStore.webrtcSignals = {};
  }
  
  const pending = remoteStore.webrtcSignals[id] || [];
  remoteStore.webrtcSignals[id] = []; // Clear queue on retrieval
  
  return NextResponse.json({ signals: pending }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    }
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { type, payload } = body;
    
    if (!type || !payload) {
      return NextResponse.json({ error: 'Type and payload are required' }, { status: 400 });
    }

    if (!remoteStore.webrtcSignals) {
      remoteStore.webrtcSignals = {};
    }

    if (!remoteStore.webrtcSignals[id]) {
      remoteStore.webrtcSignals[id] = [];
    }

    remoteStore.webrtcSignals[id].push({ type, payload });
    
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 });
  }
}
