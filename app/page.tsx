'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import VideoGrid from '@/components/VideoGrid';
import SettingsModal from '@/components/SettingsModal';
import { VideoFile } from '@/lib/videos';

interface ActivePlayback {
  videoId: string;
  videoName: string;
  playing: boolean;
}

export default function Home() {
  const [config, setConfig] = useState<{ mediaDirectory: string; exists: boolean; hostIp?: string; recentDirectories?: string[] } | null>(null);
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [remotePairOpen, setRemotePairOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePlayback, setActivePlayback] = useState<ActivePlayback | null>(null);

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

  useEffect(() => {
    // Poll for remote commands if we are the main TV screen
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/remote/tv-screen');
        if (!res.ok) return;
        const data = await res.json();
        if (data.commands && data.commands.length > 0) {
          for (const cmd of data.commands) {
            if (cmd.command === 'open_video') {
              // Redirect to player page
              window.location.href = `/player/${cmd.value}`;
            }
          }
        }
      } catch (err) {
        // ignore
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    const updateActivePlayback = async () => {
      try {
        const res = await fetch('/api/remote/active/state', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('Failed to check active playback');
        }

        const data = await res.json();
        if (!active) return;
        if (data.active && data.videoId && data.state) {
          setActivePlayback({
            videoId: String(data.videoId),
            videoName: String(data.state.videoName || 'Media'),
            playing: Boolean(data.state.playing),
          });
        } else {
          setActivePlayback(null);
        }
      } catch (err) {
        if (active) {
          console.error('Failed to check active playback', err);
        }
      }
    };

    updateActivePlayback();
    const interval = setInterval(updateActivePlayback, 2500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleSaveConfig = () => {
    // Re-fetch all config and list on saving settings
    fetchConfigAndVideos(true);
  };

  const getRemoteUrl = () => {
    const host = config?.hostIp || 'localhost';
    const port = typeof window !== 'undefined' ? window.location.port : '3000';
    const cleanPort = port ? `:${port}` : '';
    return `http://${host}${cleanPort}/remote`;
  };

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-start">
      <header className="mb-8 flex flex-col gap-5 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">myTV</h1>
          {config?.exists ? (
            <p
              className="mt-1 truncate text-sm text-zinc-500"
              title={config.mediaDirectory}
            >
              Folder · {config.mediaDirectory.split(/[\\/]/).filter(Boolean).pop() || config.mediaDirectory}
            </p>
          ) : (
            <p className="mt-1 text-sm text-zinc-500">Your local media library</p>
          )}
        </div>

        <nav aria-label="Library actions" className="flex flex-wrap items-center gap-2">
          {config && config.exists && (
            <Link
              href="/player/cast"
              className="rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            >
              Cast screen
            </Link>
          )}

          {config && config.exists && (
            <button
              onClick={() => setRemotePairOpen(true)}
              className="rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            >
              Phone remote
            </button>
          )}

          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-white"
          >
            Library folder
          </button>
        </nav>
      </header>

      {activePlayback && (
        <Link
          href={`/player/${activePlayback.videoId}`}
          className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/70 px-4 py-3 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
        >
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-xs text-zinc-500">
              <span className={`h-2 w-2 rounded-full ${activePlayback.playing ? 'bg-green-500' : 'bg-zinc-500'}`} />
              {activePlayback.playing ? 'Now playing' : 'Player open'}
            </span>
            <span className="mt-1 block truncate text-sm font-medium text-zinc-200">
              {activePlayback.videoName}
            </span>
          </span>
          <span className="shrink-0 text-sm text-zinc-300">Back to player →</span>
        </Link>
      )}

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
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 px-6 py-20 text-center">
          <h2 className="text-lg font-semibold text-zinc-100">Choose your media folder</h2>
          <p className="mt-2 max-w-sm text-sm text-zinc-500">
            Pick a folder on this computer to browse and play its videos and photos.
          </p>
          <button
            onClick={() => setSettingsOpen(true)}
            className="mt-5 rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-white"
          >
            Choose folder
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

      {/* Pair Phone Remote Modal */}
      {remotePairOpen && config && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm border border-zinc-800 bg-zinc-900 p-6 rounded-md shadow-lg text-center">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Pair Phone Remote</h2>
              <button
                onClick={() => setRemotePairOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm font-medium text-zinc-100 mb-2">Control myTV from your Phone</p>
            <p className="text-xs text-zinc-400 leading-relaxed px-2">
              Scan this QR code or open the link on your phone/tablet to search, type, and control playback remotely.
            </p>

            {/* QR Code */}
            <div className="mx-auto my-5 flex h-48 w-48 items-center justify-center bg-zinc-950 border border-zinc-800 rounded p-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  getRemoteUrl()
                )}&color=228-228-231&bgcolor=24-24-27`}
                alt="Remote QR Code"
                width={200}
                height={200}
                className="h-full w-full object-contain"
              />
            </div>

            <div className="border border-zinc-850 bg-zinc-950 p-2 rounded-md font-mono text-[11px] text-zinc-350 select-all mb-5 text-center">
              {getRemoteUrl()}
            </div>

            <button
              onClick={() => setRemotePairOpen(false)}
              className="w-full bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 py-2 text-xs font-semibold text-zinc-200 rounded-md transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
