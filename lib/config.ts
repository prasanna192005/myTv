import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_FILE = path.join(process.cwd(), 'mytv-config.json');

export interface AppConfig {
  mediaDirectory: string;
  recentDirectories: string[];
}

export function getConfig(): AppConfig {
  const defaultDir = path.join(os.homedir(), 'Videos');
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed.mediaDirectory) {
        return {
          mediaDirectory: parsed.mediaDirectory,
          recentDirectories: parsed.recentDirectories || [parsed.mediaDirectory],
        };
      }
    }
  } catch (e) {
    console.error('Failed to read config file', e);
  }

  return {
    mediaDirectory: defaultDir,
    recentDirectories: [defaultDir],
  };
}

export function updateConfig(mediaDirectory: string): AppConfig {
  const current = getConfig();
  
  // Filter out the new directory from previous position to avoid duplicates,
  // then push it to the start of the list.
  const updatedRecents = [
    mediaDirectory,
    ...current.recentDirectories.filter((d) => d.toLowerCase() !== mediaDirectory.toLowerCase()),
  ].slice(0, 10); // Limit to 10 folders

  const config: AppConfig = {
    mediaDirectory,
    recentDirectories: updatedRecents,
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  return config;
}
