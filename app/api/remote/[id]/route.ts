import { NextResponse } from 'next/server';
import { remoteStore, RemoteCommand } from '@/lib/remote-store';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Get and clear commands for this ID
  const pending = remoteStore.commands[id] || [];
  remoteStore.commands[id] = []; // Clear queue
  
  return NextResponse.json({ commands: pending });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { command, value } = body;
    
    if (!command) {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    if (!remoteStore.commands[id]) {
      remoteStore.commands[id] = [];
    }

    const newCommand: RemoteCommand = { command, value };
    remoteStore.commands[id].push(newCommand);
    
    // If it's tv-screen and command is open_video, store active id
    if (id === 'tv-screen' && command === 'open_video') {
      remoteStore.activeId = value;
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 });
  }
}
