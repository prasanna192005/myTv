import fs from 'fs';
import path from 'path';

export interface VideoFile {
  id: string;
  name: string;
  extension: string;
  size: number;
  formattedSize: string;
  relativePath: string;
  folder: string;
}

const CACHE_FILE = path.join(process.cwd(), 'mytv-cache.json');
const SUPPORTED_EXTENSIONS = new Set(['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v']);
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.next',
  '$recycle.bin',
  'system volume information',
]);

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Recursively walk a directory and gather video files
function walkDir(dir: string, baseDir: string, list: VideoFile[] = []): VideoFile[] {
  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    console.error(`Failed to read directory: ${dir}`, e);
    return list;
  }

  for (const file of files) {
    // Ignore hidden files and directories
    if (file.startsWith('.')) continue;

    const fullPath = path.join(dir, file);
    let stats: fs.Stats;
    try {
      stats = fs.statSync(fullPath);
    } catch (e) {
      continue; // Skip files with errors (permissions, broken symlinks, etc.)
    }

    if (stats.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(file.toLowerCase())) continue;
      walkDir(fullPath, baseDir, list);
    } else if (stats.isFile()) {
      const ext = path.extname(file).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        const folder = path.dirname(relativePath);
        
        list.push({
          id: '', // Will be assigned sequentially after sorting
          name: path.basename(file, ext),
          extension: ext,
          size: stats.size,
          formattedSize: formatBytes(stats.size),
          relativePath,
          folder: folder === '.' ? '' : folder,
        });
      }
    }
  }
  return list;
}

export function scanVideos(mediaDirectory: string, forceRescan = false): VideoFile[] {
  if (!mediaDirectory || !fs.existsSync(mediaDirectory)) {
    return [];
  }

  // If cache exists and we are not forcing rescan, return cache
  if (!forceRescan && fs.existsSync(CACHE_FILE)) {
    try {
      const cachedData = fs.readFileSync(CACHE_FILE, 'utf8');
      const parsed = JSON.parse(cachedData);
      
      // Self-healing: if cache has old ID formats (non-numeric), force a rescan
      const needsHealing = parsed.length > 0 && isNaN(Number(parsed[0].id));
      if (!needsHealing) {
        return parsed;
      }
    } catch (e) {
      console.error('Failed to read videos cache, rescanning...', e);
    }
  }

  const videos = walkDir(mediaDirectory, mediaDirectory);
  
  // Sort alphabetically by name
  videos.sort((a, b) => a.name.localeCompare(b.name));

  // Assign sequential short numeric IDs
  videos.forEach((video, index) => {
    video.id = String(index + 1);
  });

  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(videos, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write videos cache', e);
  }

  return videos;
}

export function getCachedVideos(): VideoFile[] {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const cachedData = fs.readFileSync(CACHE_FILE, 'utf8');
      return JSON.parse(cachedData);
    } catch (e) {
      // ignore
    }
  }
  return [];
}
