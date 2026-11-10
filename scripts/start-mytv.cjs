const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectDirectory = path.resolve(__dirname, '..');
const logPath = path.join(projectDirectory, 'mytv.log');
const logFile = fs.createWriteStream(logPath, { flags: 'a' });
const startedAt = new Date().toISOString();

logFile.write(`\n--- myTV started ${startedAt} ---\n`);
process.stdout.write(`Starting myTV. Logs are also saved to ${logPath}\n`);

const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
const args = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'npm run dev']
  : ['run', 'dev'];
const server = spawn(command, args, {
  cwd: projectDirectory,
  stdio: ['inherit', 'pipe', 'pipe'],
  windowsHide: false,
});

let browserOpened = false;
const openBrowserWhenReady = (chunk) => {
  if (browserOpened || !/ready in/i.test(chunk.toString())) return;
  browserOpened = true;

  const message = 'myTV is ready. Opening http://localhost:3000\n';
  process.stdout.write(message);
  logFile.write(message);

  if (process.platform === 'win32') {
    const browser = spawn('cmd.exe', ['/d', '/s', '/c', 'start "" "http://localhost:3000"'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    browser.on('error', (error) => {
      const errorMessage = `Could not open browser automatically: ${error.message}\n`;
      process.stderr.write(errorMessage);
      logFile.write(errorMessage);
    });
  }
};

server.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  logFile.write(chunk);
  openBrowserWhenReady(chunk);
});

server.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
  logFile.write(chunk);
  openBrowserWhenReady(chunk);
});

server.on('error', (error) => {
  const message = `Failed to start myTV: ${error.message}\n`;
  process.stderr.write(message);
  logFile.write(message);
  logFile.end();
  process.exitCode = 1;
});

server.on('close', (code) => {
  const message = `\n--- myTV stopped ${new Date().toISOString()} (exit ${code ?? 'unknown'}) ---\n`;
  process.stdout.write(message);
  logFile.write(message);
  logFile.end();
  process.exitCode = code ?? 1;
});
