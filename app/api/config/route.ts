import { NextResponse } from 'next/server';
import { getConfig, updateConfig } from '@/lib/config';
import { getLocalIp } from '@/lib/ip';
import fs from 'fs';

export async function GET() {
  const config = getConfig();
  const exists = fs.existsSync(config.mediaDirectory);
  const hostIp = getLocalIp();
  return NextResponse.json({ ...config, exists, hostIp });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mediaDirectory } = body;
    if (!mediaDirectory) {
      return NextResponse.json({ error: 'mediaDirectory is required' }, { status: 400 });
    }
    
    // Check if directory exists
    if (!fs.existsSync(mediaDirectory)) {
      return NextResponse.json({ error: 'Directory does not exist on the system' }, { status: 400 });
    }
    
    const stats = fs.statSync(mediaDirectory);
    if (!stats.isDirectory()) {
      return NextResponse.json({ error: 'Path is not a directory' }, { status: 400 });
    }

    const updated = updateConfig(mediaDirectory);
    const hostIp = getLocalIp();
    return NextResponse.json({ ...updated, exists: true, hostIp });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 });
  }
}
