'use client';

import React, { useEffect, useState } from 'react';
import VideoGrid from '@/components/VideoGrid';
import SettingsModal from '@/components/SettingsModal';
import { VideoFile } from '@/lib/videos';

export default function Home() {
  const [config, setConfig] = useState<{ mediaDirectory: string; exists: boolean } | null>(null);
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigAndVideos = async (forceScan = false) => {
    try {
      if (forceScan) {
        setScanning(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // 1. Fetch config
      const configRes = await fetch('/api/config');
      if (!configRes.ok) throw new Error('Failed to load settings');
      const configData = await configRes.json();
      setConfig(configData);

      // 2. Fetch videos if directory exists
      if (configData.exists) {
        const videosRes = await fetch(`/api/videos${forceScan ? '?scan=true' : ''}`);
        if (!videosRes.ok) throw new Error('Failed to load library');
        const videosData = await videosRes.json();
        if (videosData.success) {
          setVideos(videosData.videos);
        } else {
          throw new Error(videosData.error || 'Failed to scan videos');
        }
      } else {
        setVideos([]);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
      setScanning(false);
    }
  };

  useEffect(() => {
    fetchConfigAndVideos();
  }, []);

  const handleSaveConfig = () => {
    // Re-fetch all config and list on saving settings
    fetchConfigAndVideos(true);
  };

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-start">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-zinc-800 pb-6 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-zinc-100 font-mono">myTV</h1>
            <span className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 text-[10px] font-medium font-mono text-zinc-400 rounded">
              LOCAL
            </span>
          </div>
          {config && config.exists && (
            <p className="mt-1 text-xs text-zinc-400 font-mono">
              Scanned Path: <span className="text-zinc-350 bg-zinc-900 border border-zinc-850 px-1 py-0.5 rounded text-[11px]">{config.mediaDirectory}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center justify-center gap-2 border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 px-3 py-1.5 text-xs font-medium text-zinc-350 hover:text-zinc-200 rounded-md transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Library Folder
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-200 mb-3" />
          <p className="text-xs text-zinc-500 font-mono">Scanning local folders...</p>
        </div>
      ) : error ? (
        <div className="border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-400 rounded-md">
          <p className="font-semibold">Library Error</p>
          <p className="mt-1 text-xs">{error}</p>
          <button
            onClick={() => fetchConfigAndVideos()}
            className="mt-3 bg-red-900 hover:bg-red-850 px-3 py-1.5 text-xs text-zinc-100 rounded-md transition-colors"
          >
            Retry Scan
          </button>
        </div>
      ) : config && !config.exists ? (
        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-zinc-800 py-16 text-center rounded-md">
          <svg className="h-12 w-12 text-zinc-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <h2 className="text-base font-semibold text-zinc-200">No Scanned Folder Connected</h2>
          <p className="mt-2 text-xs text-zinc-500 max-w-sm">
            Please configure the library to point to an existing local folder with video files (e.g., MP4, MKV, WebM) on this machine.
          </p>
          <button
            onClick={() => setSettingsOpen(true)}
            className="mt-5 bg-zinc-100 hover:bg-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-950 rounded-md transition-colors"
          >
            Configure Library Folder
          </button>
        </div>
      ) : (
        <VideoGrid
          videos={videos}
          onRefresh={() => fetchConfigAndVideos(true)}
          scanning={scanning}
          hostIp={config?.hostIp || '127.0.0.1'}
        />
      )}

      {/* Settings Modal overlay */}
      {settingsOpen && config && (
        <SettingsModal
          currentPath={config.mediaDirectory}
          recentPaths={config.recentDirectories || []}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSaveConfig}
        />
      )}
    </main>
  );
}
