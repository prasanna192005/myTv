import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function isLocalRequest(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return false;

  try {
    const originUrl = new URL(origin);
    return (
      originUrl.host.toLowerCase() === host.toLowerCase() &&
      ['localhost', '127.0.0.1'].includes(originUrl.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function findPowerShell(): string {
  const windowsDirectory = process.env.SystemRoot || process.env.WINDIR;
  const candidates = [
    ...(windowsDirectory
      ? [
          path.join(windowsDirectory, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
          path.join(windowsDirectory, 'Sysnative', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
        ]
      : []),
    ...String(process.env.PATH || '')
      .split(path.delimiter)
      .filter(Boolean)
      .flatMap((directory) => [
        path.join(directory, 'powershell.exe'),
        path.join(directory, 'pwsh.exe'),
      ]),
  ];

  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) {
    throw new Error('Windows PowerShell was not found on this computer.');
  }
  return executable;
}

function openFolderDialog(): Promise<string> {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    "$dialog.Description = 'Choose your myTV media folder'",
    '$dialog.ShowNewFolderButton = $false',
    'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.SelectedPath) }',
  ].join('; ');

  return new Promise((resolve, reject) => {
    const child = spawn(findPowerShell(), ['-NoProfile', '-STA', '-Command', script], {
      windowsHide: false,
    });
    let output = '';
    let errorOutput = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      errorOutput += chunk;
    });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
      reject(new Error('Folder picker timed out. Check whether the dialog is hidden behind another window.'));
    }, 60 * 1000);
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (timedOut) return;
      if (code !== 0) {
        reject(new Error(errorOutput.trim() || `Folder picker exited with code ${code}`));
        return;
      }
      resolve(output.trim());
    });
  });
}

export async function POST(request: Request) {
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: 'Open myTV on this computer using localhost to browse for a folder.' },
      { status: 403 },
    );
  }

  if (process.platform !== 'win32') {
    return NextResponse.json(
      { error: 'The native folder picker is currently available only on Windows.' },
      { status: 501 },
    );
  }

  try {
    const path = await openFolderDialog();
    return NextResponse.json({ path: path || null });
  } catch (error) {
    console.error('Failed to open native folder picker', error);
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : 'Could not open the Windows folder picker.',
      },
      { status: 500 },
    );
  }
}
