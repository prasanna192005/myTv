'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { VideoFile } from '@/lib/videos';
import ShareTvModal from '@/components/ShareTvModal';

interface VideoGridProps {
  videos: VideoFile[];
  onRefresh: () => Promise<void>;
  scanning: boolean;
  hostIp: string;
}

export default function VideoGrid({ videos, onRefresh, scanning, hostIp }: VideoGridProps) {
  const [search, setSearch] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'folder'>('name');
  const [sharingVideo, setSharingVideo] = useState<VideoFile | null>(null);

  // Extract unique subfolders and extensions
  const folders = useMemo(() => {
    return Array.from(new Set(videos.map((v) => v.folder).filter(Boolean))).sort();
  }, [videos]);

  const formats = useMemo(() => {
    return Array.from(new Set(videos.map((v) => v.extension))).sort();
  }, [videos]);

  // Filters and sorts videos
  const processedVideos = useMemo(() => {
    let result = videos.filter((video) => {
      const matchesSearch =
        video.name.toLowerCase().includes(search.toLowerCase()) ||
        video.relativePath.toLowerCase().includes(search.toLowerCase());
      const matchesFolder = selectedFolder === '' || video.folder === selectedFolder;
      const matchesFormat = selectedFormat === '' || video.extension === selectedFormat;
      return matchesSearch && matchesFolder && matchesFormat;
    });

    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'size') {
      result.sort((a, b) => b.size - a.size); // Largest first
    } else if (sortBy === 'folder') {
      result.sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name));
    }

    return result;
  }, [videos, search, selectedFolder, selectedFormat, sortBy]);

  const handleShareClick = (e: React.MouseEvent, video: VideoFile) => {
    e.preventDefault();
    e.stopPropagation();
    setSharingVideo(video);
  };

  const getTvUrl = (videoId: string) => {
    const port = typeof window !== 'undefined' ? window.location.port : '3000';
    const cleanPort = port ? `:${port}` : '';
    return `http://${hostIp || '127.0.0.1'}${cleanPort}/player/${videoId}`;
  };

  return (
    <div className="space-y-6">
      {/* Filters Toolbar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border border-zinc-800 bg-zinc-900/40 p-4 rounded-md">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          {/* Search */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search library..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 pl-9 text-sm text-zinc-100 placeholder-zinc-550 rounded-md focus:outline-none focus:border-zinc-700"
            />
            <svg
              className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Folder Filter */}
          {folders.length > 0 && (
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 rounded-md focus:outline-none focus:border-zinc-700"
            >
              <option value="">All folders</option>
              {folders.map((folder) => (
                <option key={folder} value={folder}>
                  {folder}
                </option>
              ))}
            </select>
          )}

          {/* Format Filter */}
          {formats.length > 1 && (
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 rounded-md focus:outline-none focus:border-zinc-700"
            >
              <option value="">All formats</option>
              {formats.map((format) => (
                <option key={format} value={format}>
                  {format.toUpperCase()}
                </option>
              ))}
            </select>
          )}

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 rounded-md focus:outline-none focus:border-zinc-700"
          >
            <option value="name">Sort by Name</option>
            <option value="size">Sort by Size</option>
            {folders.length > 0 && <option value="folder">Sort by Folder</option>}
          </select>
        </div>

        {/* Rescan trigger */}
        <button
          onClick={() => onRefresh()}
          disabled={scanning}
          className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 rounded-md transition-colors disabled:opacity-50"
        >
          <svg
            className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12"
            />
          </svg>
          {scanning ? 'Scanning...' : 'Rescan Folder'}
        </button>
      </div>

      {/* Grid List */}
      {processedVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-zinc-800 py-16 text-center rounded-md">
          <svg
            className="h-10 w-10 text-zinc-600 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
            />
          </svg>
          <h3 className="text-sm font-medium text-zinc-300">No video files found</h3>
          <p className="mt-1 text-xs text-zinc-550 max-w-xs">
            {videos.length === 0
              ? 'Ensure your library directory contains supported formats (.mp4, .mkv, .webm).'
              : 'Try clearing your active filters or query.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {processedVideos.map((video) => (
            <Link
              key={video.id}
              href={`/player/${video.id}`}
              className="group relative flex flex-col justify-between border border-zinc-850 bg-zinc-900 p-4 rounded-md transition-all hover:border-zinc-700 hover:bg-zinc-900/90 shadow-sm"
            >
              {/* File Icon Overlay */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-zinc-950 border border-zinc-800 text-zinc-400 group-hover:text-zinc-200 group-hover:border-zinc-700 rounded transition-all">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <h4 className="truncate text-sm font-medium text-zinc-200 group-hover:text-zinc-50 transition-colors" title={video.name}>
                      {video.name}
                    </h4>
                    {/* Play on TV trigger */}
                    <button
                      onClick={(e) => handleShareClick(e, video)}
                      className="opacity-0 group-hover:opacity-100 hover:text-zinc-150 text-zinc-500 p-0.5 transition-opacity duration-150 shrink-0"
                      title="Open Link on TV"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  </div>
                  {video.folder && (
                    <span className="truncate block mt-0.5 text-[10px] font-mono text-zinc-500">
                      {video.folder}
                    </span>
                  )}
                </div>
              </div>

              {/* Specs Indicators */}
              <div className="mt-4 flex items-center justify-between border-t border-zinc-850/60 pt-3">
                <span className="text-xs text-zinc-400">{video.formattedSize}</span>
                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium border border-zinc-800 text-zinc-500 rounded bg-zinc-950 uppercase">
                  {video.extension.replace('.', '')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Share TV Modal Overlay */}
      {sharingVideo && (
        <ShareTvModal
          videoName={sharingVideo.name}
          videoUrl={getTvUrl(sharingVideo.id)}
          onClose={() => setSharingVideo(null)}
        />
      )}
    </div>
  );
}
