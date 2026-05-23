import fs from 'fs';
import path from 'path';
import { getConfig } from './config';

export interface VideoFile {
  id: string;
  name: string;
  extension: string;
  size: number;
  formattedSize: string;
  relativePath: string;
  folder: string;
  type: 'video' | 'image';
  subtitlePath?: string;
  posterPath?: string;
}

const CACHE_FILE = path.join(process.cwd(), 'mytv-cache.json');
const SUPPORTED_VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v']);
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
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

// Recursively walk a directory and gather video and image files
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
      const isVideo = SUPPORTED_VIDEO_EXTENSIONS.has(ext);
      const isImage = SUPPORTED_IMAGE_EXTENSIONS.has(ext);

      if (isVideo || isImage) {
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        const folder = path.dirname(relativePath);
        const baseName = path.basename(file, ext);
        const dirPath = path.dirname(fullPath);

        if (isVideo) {
          // Find matching subtitle files in the same directory
          let subtitlePath: string | undefined = undefined;
          
          const matchingSub = files.find(f => {
            const fLower = f.toLowerCase();
            const baseNameLower = baseName.toLowerCase();
            
            const isSubExt = fLower.endsWith('.srt') || fLower.endsWith('.vtt');
            if (!isSubExt) return false;
            
            if (!fLower.startsWith(baseNameLower)) return false;
            
            const suffix = fLower.substring(baseNameLower.length);
            return (
              suffix.startsWith('.') ||
              suffix.startsWith('_') ||
              suffix.startsWith('-') ||
              suffix.startsWith(' -')
            );
          });

          if (matchingSub) {
            const subFullPath = path.join(dirPath, matchingSub);
            subtitlePath = path.relative(baseDir, subFullPath).replace(/\\/g, '/');
          }

          // Find companion poster image (e.g. Inception.jpg)
          let posterPath: string | undefined = undefined;
          const matchingPoster = files.find(f => {
            const fLower = f.toLowerCase();
            const baseNameLower = baseName.toLowerCase();
            const isImageExt = fLower.endsWith('.jpg') || fLower.endsWith('.png') || fLower.endsWith('.jpeg') || fLower.endsWith('.webp');
            if (!isImageExt) return false;
            if (!fLower.startsWith(baseNameLower)) return false;
            const suffix = fLower.substring(baseNameLower.length);
            return (
              suffix.startsWith('.') ||
              suffix.startsWith('_') ||
              suffix.startsWith('-') ||
              suffix.startsWith(' -') ||
              suffix === ''
            );
          });

          if (matchingPoster) {
            const posterFullPath = path.join(dirPath, matchingPoster);
            posterPath = path.relative(baseDir, posterFullPath).replace(/\\/g, '/');
          } else {
            // Check for default folder posters: poster.jpg, folder.jpg, cover.jpg, folder.png, poster.png
            const defaultPosters = ['poster.jpg', 'poster.png', 'folder.jpg', 'cover.jpg', 'poster.jpeg', 'folder.jpeg', 'cover.jpeg'];
            for (const dp of defaultPosters) {
              const dpFullPath = path.join(dirPath, dp);
              if (fs.existsSync(dpFullPath)) {
                posterPath = path.relative(baseDir, dpFullPath).replace(/\\/g, '/');
                break;
              }
            }
          }
          
          list.push({
            id: '', // Will be assigned sequentially after sorting
            name: baseName,
            extension: ext,
            size: stats.size,
            formattedSize: formatBytes(stats.size),
            relativePath,
            folder: folder === '.' ? '' : folder,
            type: 'video',
            subtitlePath,
            posterPath,
          });
        } else if (isImage) {
          // Skip if this image is metadata or a companion poster for a video in the same directory
          const lowerFile = file.toLowerCase();
          const isMetadataImage = ['poster.jpg', 'poster.png', 'folder.jpg', 'cover.jpg', 'poster.jpeg', 'folder.jpeg', 'cover.jpeg'].includes(lowerFile);
          
          let isVideoPoster = false;
          const videoExtensions = ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v'];
          for (const vext of videoExtensions) {
            if (fs.existsSync(path.join(dirPath, baseName + vext))) {
              isVideoPoster = true;
              break;
            }
          }

          if (!isMetadataImage && !isVideoPoster) {
            list.push({
              id: '',
              name: baseName,
              extension: ext,
              size: stats.size,
              formattedSize: formatBytes(stats.size),
              relativePath,
              folder: folder === '.' ? '' : folder,
              type: 'image',
            });
          }
        }
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
      const parsed = JSON.parse(cachedData);
      
      // Self-healing: if cache has old ID formats (non-numeric), force a rescan
      const needsHealing = parsed.length > 0 && isNaN(Number(parsed[0].id));
      if (!needsHealing) {
        return parsed;
      }
      
      const config = getConfig();
      return scanVideos(config.mediaDirectory, true);
    } catch (e) {
      // ignore
    }
  }
  return [];
}
