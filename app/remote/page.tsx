'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { VideoFile } from '@/lib/videos';
import { PlayerState } from '@/lib/remote-store';

function formatTime(seconds: number) {
  if (isNaN(seconds)) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function RemotePage() {
  const [activeSession, setActiveSession] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [playState, setPlayState] = useState<PlayerState | null>(null);
  const [localCurrentTime, setLocalCurrentTime] = useState(0);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [hostIp, setHostIp] = useState('127.0.0.1');
  const [loading, setLoading] = useState(true);

  // 1. Fetch library catalog and config
  useEffect(() => {
    const initFetch = async () => {
      try {
        const configRes = await fetch('/api/config');
        if (configRes.ok) {
          const configData = await configRes.json();
          setHostIp(configData.hostIp || '127.0.0.1');
        }

        const videosRes = await fetch('/api/videos');
        if (videosRes.ok) {
          const videosData = await videosRes.json();
          if (videosData.success) {
            setVideos(videosData.videos);
          }
        }
      } catch (err) {
        console.error('Remote initialization error', err);
      } finally {
        setLoading(false);
      }
    };
    initFetch();
  }, []);

  // 2. Poll active player state
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/remote/active/state');
        if (!res.ok) return;
        const data = await res.json();
        if (data.active) {
          setActiveSession(true);
          setVideoId(data.videoId);
          setPlayState(data.state);
          if (!isDraggingSeek) {
            setLocalCurrentTime(data.state.currentTime);
          }
        } else {
          setActiveSession(false);
          setVideoId(null);
          setPlayState(null);
        }
      } catch (err) {
        // ignore
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isDraggingSeek]);

  const sendCommand = async (command: string, value?: any) => {
    const target = activeSession && videoId ? videoId : 'tv-screen';
    try {
      await fetch(`/api/remote/${target}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, value }),
      });
    } catch (err) {
      console.error('Failed to send command', err);
    }
  };

  // Filter videos for the search screen
  const filteredVideos = useMemo(() => {
    if (!searchQuery) return videos;
    return videos.filter(
      (v) =>
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.folder && v.folder.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [videos, searchQuery]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalCurrentTime(Number(e.target.value));
  };

  const handleSeekEnd = () => {
    setIsDraggingSeek(false);
    sendCommand('seek', localCurrentTime);
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-zinc-950 p-6 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-200 mb-3" />
        <p className="text-xs text-zinc-500 font-mono">Initializing Remote Control...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-950 text-zinc-100 max-w-md mx-auto w-full border-x border-zinc-900 min-h-screen">
      {activeSession && playState ? (
        /* ACTIVE PLAYER CONTROL VIEW */
        <div className="flex flex-col flex-1 p-6 justify-between select-none">
          {/* Header */}
          <div className="text-center border-b border-zinc-900 pb-4">
            <span className="text-[10px] font-bold tracking-wider text-green-500 uppercase flex items-center justify-center gap-1.5 mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-ping" />
              Connected to TV
            </span>
            <h1 className="text-sm font-medium font-mono text-zinc-350 truncate max-w-xs mx-auto px-4" title={playState.videoName}>
              {playState.videoName}
            </h1>
          </div>

          {/* Central Play/Pause Circle */}
          <div className="my-auto py-12 flex flex-col items-center justify-center gap-3">
            <button
              onClick={() => sendCommand(playState.playing ? 'pause' : 'play')}
              className="h-28 w-28 rounded-full bg-zinc-100 text-zinc-950 hover:bg-zinc-200 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              {playState.playing ? (
                <svg className="h-12 w-12" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-12 w-12 pl-1.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <span className="text-[10px] font-mono text-zinc-550 uppercase tracking-wider">
              {playState.mediaType === 'image'
                ? (playState.playing ? 'Slideshow Active' : 'Slideshow Paused')
                : (playState.playing ? 'Video Playing' : 'Video Paused')}
            </span>
          </div>

          {/* Scrub Seek Bar & Indicators */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-xs font-mono text-zinc-400">
              {playState.mediaType === 'image' ? (
                <>
                  <span>Slide Elapsed: {Math.round(localCurrentTime)}s</span>
                  <span>5s</span>
                </>
              ) : (
                <>
                  <span>{formatTime(localCurrentTime)}</span>
                  <span>{formatTime(playState.duration)}</span>
                </>
              )}
            </div>
            <input
              type="range"
              min="0"
              max={playState.duration || 100}
              value={localCurrentTime}
              onChange={handleSeekChange}
              onMouseDown={() => setIsDraggingSeek(true)}
              onTouchStart={() => setIsDraggingSeek(true)}
              onMouseUp={handleSeekEnd}
              onTouchEnd={handleSeekEnd}
              disabled={playState.mediaType === 'image'}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>

          {/* Controls Panel */}
          {playState.mediaType === 'image' ? (
            /* PHOTO SLIDESHOW CONTROLLER */
            <div className="space-y-4 mb-6">
              {/* Slide controls */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => sendCommand('prev_image')}
                  className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 py-4 text-xs font-semibold rounded-md active:bg-zinc-850 flex items-center justify-center gap-1.5"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous Image
                </button>
                <button
                  onClick={() => sendCommand('next_image')}
                  className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 py-4 text-xs font-semibold rounded-md active:bg-zinc-850 flex items-center justify-center gap-1.5"
                >
                  Next Image
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Fullscreen trigger */}
              <button
                onClick={() => sendCommand('fullscreen')}
                className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 py-3 text-xs font-semibold rounded-md text-zinc-400 active:bg-zinc-850 flex items-center justify-center gap-1.5"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V5a2 2 0 012-2h2M3 16v3a2 2 0 002 2h3m8-18h3a2 2 0 012 2v3m-2 11v3a2 2 0 01-2 2h-3" />
                </svg>
                Toggle Fullscreen
              </button>
            </div>
          ) : (
            /* VIDEO CONTROLLER PANEL */
            <div className="space-y-4 mb-6">
              {/* Quick Seekers */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => sendCommand('seek', Math.max(0, localCurrentTime - 10))}
                  className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 py-3 text-xs font-semibold rounded-md active:bg-zinc-850 flex items-center justify-center gap-1"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                  </svg>
                  -10s
                </button>
                <button
                  onClick={() => sendCommand('seek', Math.min(playState.duration, localCurrentTime + 10))}
                  className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 py-3 text-xs font-semibold rounded-md active:bg-zinc-850 flex items-center justify-center gap-1"
                >
                  +10s
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.934 12.8a1 1 0 000-1.6l-5.334-4A1 1 0 005 8v8a1 1 0 001.6.8l5.334-4zM19.934 12.8a1 1 0 000-1.6l-5.334-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.334-4z" />
                  </svg>
                </button>
              </div>

              {/* Hardware Controls */}
              <div className="grid grid-cols-3 gap-3">
                {/* Mute */}
                <button
                  onClick={() => sendCommand(playState.muted ? 'unmute' : 'mute')}
                  className={`border py-3 text-xs font-semibold rounded-md flex flex-col items-center justify-center gap-1 active:bg-zinc-850 ${
                    playState.muted
                      ? 'border-red-900 bg-red-950/20 text-red-400'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300'
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  Mute
                </button>

                {/* Volume Slider Helpers */}
                <button
                  onClick={() => sendCommand('volume', Math.max(0, playState.volume - 0.1))}
                  className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 py-3 text-xs font-semibold rounded-md active:bg-zinc-850 text-zinc-300 flex flex-col items-center justify-center gap-1"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                  Vol -
                </button>
                <button
                  onClick={() => sendCommand('volume', Math.min(1, playState.volume + 0.1))}
                  className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 py-3 text-xs font-semibold rounded-md active:bg-zinc-850 text-zinc-300 flex flex-col items-center justify-center gap-1"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Vol +
                </button>
              </div>
              
              {/* Fullscreen & Subtitles */}
              <div className={playState.hasSubtitles ? "grid grid-cols-2 gap-3" : "w-full"}>
                <button
                  onClick={() => sendCommand('fullscreen')}
                  className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 py-2.5 text-xs font-semibold rounded-md text-zinc-400 active:bg-zinc-850 flex items-center justify-center gap-1.5"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V5a2 2 0 012-2h2M3 16v3a2 2 0 002 2h3m8-18h3a2 2 0 012 2v3m-2 11v3a2 2 0 01-2 2h-3" />
                  </svg>
                  Toggle Fullscreen
                </button>

                {playState.hasSubtitles && (
                  <button
                    onClick={() => sendCommand('subtitles')}
                    className={`w-full border py-2.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 active:bg-zinc-850 transition-colors ${
                      playState.subtitlesVisible
                        ? 'border-zinc-700 bg-zinc-800 text-zinc-100'
                        : 'border-zinc-850 bg-zinc-900/60 text-zinc-500 hover:text-zinc-400'
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth={1.8} />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 10h2M7 14h4M13 10h4M13 14h2" />
                    </svg>
                    Subtitles: {playState.subtitlesVisible ? 'On' : 'Off'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Stop and return */}
          <button
            onClick={() => sendCommand('back')}
            className="w-full bg-zinc-950 border border-red-950 hover:bg-red-950/10 py-3 text-xs font-semibold text-red-400 rounded-md transition-colors"
          >
            Stop Video & Return to Library
          </button>
        </div>
      ) : (
        /* LIBRARY CONTROLLER VIEW (NO VIDEO RUNNING) */
        <div className="flex flex-col flex-1 p-6 justify-start">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-md font-bold tracking-tight text-zinc-200 font-mono">myTV Controller</h1>
            <p className="text-xs text-zinc-550 mt-1">TV Screen is idle. Type to search or tap a video to launch on TV.</p>
          </div>

          {/* Keyboard Input Search bar */}
          <div className="relative mb-5">
            <input
              type="text"
              placeholder="Type to search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[calc(100vh-180px)]">
            {filteredVideos.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-zinc-850 rounded text-zinc-550 text-xs font-mono">
                No matching videos found
              </div>
            ) : (
              filteredVideos.map((video) => (
                <button
                  key={video.id}
                  onClick={() => sendCommand('open_video', video.id)}
                  className="w-full text-left border border-zinc-850 bg-zinc-900/60 p-3 rounded-md hover:bg-zinc-900 hover:border-zinc-700 transition-colors flex items-center justify-between gap-3 group active:bg-zinc-850"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-zinc-200 truncate group-hover:text-zinc-50">
                      {video.name}
                    </span>
                    {video.folder && (
                      <span className="block text-[9px] font-mono text-zinc-550 truncate mt-0.5">
                        {video.folder}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <span className="text-[8px] font-bold font-mono border border-zinc-800 text-zinc-500 rounded bg-zinc-950 px-1 uppercase tracking-wider">
                      {video.type}
                    </span>
                    <span className="text-[9px] font-mono border border-zinc-800 text-zinc-500 rounded bg-zinc-950 px-1 uppercase">
                      {video.extension.replace('.', '')}
                    </span>
                    <svg className="h-4 w-4 text-zinc-650 group-hover:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
