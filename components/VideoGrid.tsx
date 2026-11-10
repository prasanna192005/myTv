'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'video' | 'image'>('all');
  const [progressMap, setProgressMap] = useState<Record<string, { currentTime: number; duration: number }>>({});

  // Fetch local watch progress on mount/videos catalog refresh
  useEffect(() => {
    const map: Record<string, { currentTime: number; duration: number }> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('mytv-progress-')) {
          const id = key.substring('mytv-progress-'.length);
          const val = localStorage.getItem(key);
          if (val) {
            map[id] = JSON.parse(val);
          }
        }
      }
      setProgressMap(map);
    } catch (e) {
      console.error('Failed to load local watch progress', e);
    }
  }, [videos]);

  // Extract unique subfolders and extensions based on active media tab
  const folders = useMemo(() => {
    const filteredByTab = videos.filter(
      (v) => mediaTypeFilter === 'all' || v.type === mediaTypeFilter
    );
    return Array.from(new Set(filteredByTab.map((v) => v.folder).filter(Boolean))).sort();
  }, [videos, mediaTypeFilter]);

  const formats = useMemo(() => {
    const filteredByTab = videos.filter(
      (v) => mediaTypeFilter === 'all' || v.type === mediaTypeFilter
    );
    return Array.from(new Set(filteredByTab.map((v) => v.extension))).sort();
  }, [videos, mediaTypeFilter]);

  // Filters and sorts videos/images
  const processedVideos = useMemo(() => {
    let result = videos.filter((video) => {
      const matchesType = mediaTypeFilter === 'all' || video.type === mediaTypeFilter;
      const matchesSearch =
        video.name.toLowerCase().includes(search.toLowerCase()) ||
        video.relativePath.toLowerCase().includes(search.toLowerCase());
      const matchesFolder = selectedFolder === '' || video.folder === selectedFolder;
      const matchesFormat = selectedFormat === '' || video.extension === selectedFormat;
      return matchesType && matchesSearch && matchesFolder && matchesFormat;
    });

    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'size') {
      result.sort((a, b) => b.size - a.size); // Largest first
    } else if (sortBy === 'folder') {
      result.sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name));
    }

    return result;
  }, [videos, search, selectedFolder, selectedFormat, sortBy, mediaTypeFilter]);

  const continueWatching = useMemo(
    () =>
      videos
        .filter((video) => {
          const progress = progressMap[video.id];
          return (
            video.type === 'video' &&
            progress?.duration > 0 &&
            progress.currentTime > 10 &&
            progress.currentTime < progress.duration - 15
          );
        })
        .slice(0, 6),
    [videos, progressMap],
  );

  const activeFilterCount = Number(Boolean(selectedFolder)) + Number(Boolean(selectedFormat));

  const clearFilters = () => {
    setSearch('');
    setSelectedFolder('');
    setSelectedFormat('');
    setMediaTypeFilter('all');
  };

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Library</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {processedVideos.length === videos.length
              ? `${videos.length} items`
              : `${processedVideos.length} of ${videos.length} items`}
          </p>
        </div>
        <button
          onClick={() => onRefresh()}
          disabled={scanning}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-900 disabled:opacity-50"
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
          {scanning ? 'Scanning...' : 'Rescan'}
        </button>
      </div>

      <div className="flex gap-2" role="group" aria-label="Filter by media type">
        {([
          ['all', 'All'],
          ['video', 'Videos'],
          ['image', 'Photos'],
        ] as const).map(([type, label]) => {
          const count = type === 'all' ? videos.length : videos.filter((video) => video.type === type).length;
          return (
            <button
              key={type}
              onClick={() => {
                setMediaTypeFilter(type);
                setSelectedFormat('');
                setSelectedFolder('');
              }}
              aria-pressed={mediaTypeFilter === type}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                mediaTypeFilter === type
                  ? 'bg-zinc-100 font-medium text-zinc-950'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              {label} <span className={mediaTypeFilter === type ? 'opacity-60' : 'text-zinc-600'}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          aria-label="Search library"
          placeholder={`Search ${mediaTypeFilter === 'all' ? 'library' : mediaTypeFilter === 'video' ? 'videos' : 'photos'}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
        />
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-md border border-zinc-800 px-4 py-3 text-center text-sm text-zinc-300 transition-colors hover:bg-zinc-900 sm:min-w-32">
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''} & sort
          </summary>
          <div className="absolute right-0 z-20 mt-2 grid w-64 gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-xl">
            {folders.length > 0 && (
              <select
                aria-label="Filter by folder"
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 focus:outline-none"
              >
                <option value="">All folders</option>
                {folders.map((folder) => (
                  <option key={folder} value={folder}>
                    {folder}
                  </option>
                ))}
              </select>
            )}
            {formats.length > 1 && (
              <select
                aria-label="Filter by format"
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 focus:outline-none"
              >
                <option value="">All formats</option>
                {formats.map((format) => (
                  <option key={format} value={format}>
                    {format.toUpperCase()}
                  </option>
                ))}
              </select>
            )}
            <select
              aria-label="Sort library"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'size' | 'folder')}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 focus:outline-none"
            >
              <option value="name">Name</option>
              <option value="size">File size</option>
              {folders.length > 0 && <option value="folder">Folder</option>}
            </select>
          </div>
        </details>
      </div>

      {(search || selectedFolder || selectedFormat) && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {search && (
            <button
              onClick={() => setSearch('')}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              aria-label={`Clear search: ${search}`}
            >
              Search: {search} <span aria-hidden="true">×</span>
            </button>
          )}
          {selectedFolder && (
            <button
              onClick={() => setSelectedFolder('')}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              aria-label={`Clear folder filter: ${selectedFolder}`}
            >
              {selectedFolder} <span aria-hidden="true">×</span>
            </button>
          )}
          {selectedFormat && (
            <button
              onClick={() => setSelectedFormat('')}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              aria-label={`Clear format filter: ${selectedFormat}`}
            >
              {selectedFormat.replace('.', '').toUpperCase()} <span aria-hidden="true">×</span>
            </button>
          )}
          <button
            onClick={clearFilters}
            className="px-2 py-1 text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {continueWatching.length > 0 && (
        <section aria-labelledby="continue-watching-heading" className="space-y-3">
          <div>
            <h3 id="continue-watching-heading" className="text-base font-semibold text-zinc-100">
              Continue watching
            </h3>
            <p className="mt-1 text-sm text-zinc-500">Pick up where you left off</p>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {continueWatching.map((video) => {
              const progress = progressMap[video.id];
              const progressPercent = Math.min(100, (progress.currentTime / progress.duration) * 100);
              return (
                <Link
                  key={video.id}
                  href={`/player/${video.id}`}
                  className="group w-52 shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-600 sm:w-60"
                >
                  <div className="relative aspect-video bg-zinc-950">
                    {video.posterPath ? (
                      <img
                        src={`/api/media/image/${video.id}?poster=true`}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-zinc-700">
                        <span className="text-xs">No poster</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-zinc-700">
                      <div className="h-full bg-red-500" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-zinc-200">{video.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {Math.round(progressPercent)}% watched · Resume
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Grid List */}
      {processedVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-zinc-850 py-16 text-center rounded-md">
          <svg
            className="h-10 w-10 text-zinc-650 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <h3 className="text-sm font-medium text-zinc-350">No files found</h3>
          <p className="mt-1 text-xs text-zinc-550 max-w-xs leading-relaxed">
            {videos.length === 0
              ? 'Ensure your library directory contains supported videos (.mp4, .mkv) or photos (.jpg, .png).'
              : 'Try clearing your active filters or search query.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {processedVideos.map((video) => {
            const progress = progressMap[video.id];
            const progressPercent = progress ? (progress.currentTime / progress.duration) * 100 : 0;
            return (
              <Link
                key={video.id}
                href={`/player/${video.id}`}
                className="group flex flex-col overflow-hidden border border-zinc-850 bg-zinc-900 rounded-md transition-all hover:border-zinc-750 hover:bg-zinc-900/90 shadow-sm relative"
              >
                {/* Media Card Thumbnail Section */}
                <div className={`relative w-full bg-zinc-950 border-b border-zinc-850/80 overflow-hidden flex items-center justify-center select-none ${
                  video.type === 'video' ? 'aspect-[2/3]' : 'aspect-video'
                }`}>
                  {video.type === 'video' ? (
                    video.posterPath ? (
                      <img
                        src={`/api/media/image/${video.id}?poster=true`}
                        alt={video.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-700 group-hover:text-zinc-500 transition-colors">
                        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                          />
                        </svg>
                      </div>
                    )
                  ) : (
                    <img
                      src={`/api/media/image/${video.id}`}
                      alt={video.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}

                  {/* Media Type Tag */}
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 border border-zinc-800/80 text-[8px] font-bold font-mono text-zinc-400 uppercase tracking-wider">
                    {video.type}
                  </div>

                  {/* Play on TV Button Overlaid on Thumbnail */}
                  <button
                    onClick={(e) => handleShareClick(e, video)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-black/85 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-150 p-1.5 rounded transition-all duration-150 shadow"
                    title="Open Link on TV"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </button>

                  {/* Watch Progress Bar Overlay */}
                  {progressPercent > 0 && (
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-zinc-800/85 z-10">
                      <div className="h-full bg-red-600" style={{ width: `${progressPercent}%` }} />
                    </div>
                  )}
                </div>

                {/* Media Details */}
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-medium text-zinc-200 group-hover:text-zinc-50 transition-colors" title={video.name}>
                      {video.name}
                    </h4>
                    {video.folder && (
                      <span className="truncate block mt-1 text-[10px] font-mono text-zinc-550">
                        {video.folder}
                      </span>
                    )}
                  </div>

                  {/* Card Specs Footer */}
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-600">
                    <span>{video.extension.replace('.', '').toUpperCase()}</span>
                    <span aria-hidden="true">·</span>
                    <span>{video.formattedSize}</span>
                  </div>
                </div>
              </Link>
            );
          })}
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
