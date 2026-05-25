'use client';

import React, { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ShareTvModal from '@/components/ShareTvModal';

interface PlayerPageProps {
  params: Promise<{ id: string }>;
}

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

export default function PlayerPage({ params }: PlayerPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [videoName, setVideoName] = useState('');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [hostIp, setHostIp] = useState('127.0.0.1');
  const [shareOpen, setShareOpen] = useState(false);
  const [hasSubtitles, setHasSubtitles] = useState(false);
  const [subtitlesVisible, setSubtitlesVisible] = useState(true);
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [resumeTime, setResumeTime] = useState<number | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Keep latest state in a ref to prevent interval resets during playback
  const stateRef = useRef({
    playing,
    videoName,
    videoError,
    hasSubtitles,
    subtitlesVisible,
    mediaType,
    currentTime,
  });

  useEffect(() => {
    stateRef.current = {
      playing,
      videoName,
      videoError,
      hasSubtitles,
      subtitlesVisible,
      mediaType,
      currentTime,
    };
  });

  // Fetch metadata and host IP for playback and TV sharing
  useEffect(() => {
    setVideoName(`Video ${id}`);

    fetch('/api/config', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.hostIp) {
          setHostIp(data.hostIp);
        }
      })
      .catch((err) => console.error('Failed to get host IP:', err));

    fetch('/api/videos', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.videos) {
          const video = data.videos.find((v: any) => v.id === id);
          if (video) {
            setVideoName(video.name);
            setHasSubtitles(!!video.subtitlePath);
            setMediaType(video.type || 'video');
          }
        }
      })
      .catch((err) => console.error('Failed to load video metadata:', err));
  }, [id]);

  // Resume Progress checking on mount/metadata loaded
  useEffect(() => {
    if (!duration || mediaType !== 'video') return;
    
    try {
      const saved = localStorage.getItem(`mytv-progress-${id}`);
      if (saved) {
        const { currentTime: savedTime, duration: savedDuration } = JSON.parse(saved);
        // Only prompt if watched more than 10s and not finished (within 15s of end)
        if (savedTime > 10 && savedTime < savedDuration - 15) {
          setResumeTime(savedTime);
          setShowResumePrompt(true);
          
          // Auto dismiss prompt after 8 seconds
          const timer = setTimeout(() => {
            setShowResumePrompt(false);
          }, 8000);
          return () => clearTimeout(timer);
        }
      }
    } catch (e) {
      console.error('Failed to read saved playback progress', e);
    }
  }, [id, duration, mediaType]);

  const handleResumePlayback = () => {
    if (videoRef.current && resumeTime) {
      videoRef.current.currentTime = resumeTime;
      setCurrentTime(resumeTime);
    }
    setShowResumePrompt(false);
  };

  const handleStartOver = () => {
    try {
      localStorage.removeItem(`mytv-progress-${id}`);
    } catch (e) {}
    setShowResumePrompt(false);
  };

  // Slideshow Navigation Helper
  const navigateImage = (direction: 'next' | 'prev') => {
    fetch('/api/videos')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.videos) {
          const imagesOnly = data.videos.filter((v: any) => v.type === 'image');
          if (imagesOnly.length <= 1) return;
          const currentIndex = imagesOnly.findIndex((v: any) => v.id === id);
          if (currentIndex === -1) return;
          let targetIndex = currentIndex + (direction === 'next' ? 1 : -1);
          if (targetIndex >= imagesOnly.length) {
            targetIndex = 0;
          } else if (targetIndex < 0) {
            targetIndex = imagesOnly.length - 1;
          }
          const targetImage = imagesOnly[targetIndex];
          router.replace(`/player/${targetImage.id}`);
        }
      })
      .catch((err) => console.error('Slideshow navigation error:', err));
  };

  // TV Slideshow auto-advance timer
  useEffect(() => {
    if (mediaType !== 'image' || !playing) return;
    setDuration(5);
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= 4.9) {
          navigateImage('next');
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [id, playing, mediaType]);

  // TV Remote: Publish player state every 1 second
  useEffect(() => {
    const interval = setInterval(async () => {
      const {
        playing: currentPlaying,
        videoName: currentVideoName,
        videoError: currentVideoError,
        hasSubtitles: currentHasSubtitles,
        subtitlesVisible: currentSubtitlesVisible,
        mediaType: currentMediaType,
        currentTime: currentImageTime,
      } = stateRef.current;

      if (currentVideoError) return;
      
      let state;
      if (currentMediaType === 'video') {
        if (!videoRef.current) return;
        const curTime = videoRef.current.currentTime;
        const dur = videoRef.current.duration || 0;

        state = {
          playing: currentPlaying,
          currentTime: curTime,
          duration: dur,
          volume: videoRef.current.volume,
          muted: videoRef.current.muted,
          videoName: currentVideoName,
          hasSubtitles: currentHasSubtitles,
          subtitlesVisible: currentSubtitlesVisible,
          mediaType: 'video',
        };

        // Save watch progress locally
        if (dur > 0) {
          try {
            if (curTime > dur - 15) {
              localStorage.removeItem(`mytv-progress-${id}`);
            } else {
              localStorage.setItem(
                `mytv-progress-${id}`,
                JSON.stringify({ currentTime: curTime, duration: dur })
              );
            }
          } catch (e) {}
        }
      } else {
        state = {
          playing: currentPlaying,
          currentTime: currentImageTime,
          duration: 5,
          volume: 0,
          muted: true,
          videoName: currentVideoName,
          hasSubtitles: false,
          subtitlesVisible: false,
          mediaType: 'image',
        };
      }

      try {
        await fetch(`/api/remote/${id}/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state),
        });
      } catch (err) {
        // ignore
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [id]);

  // TV Remote: Poll and execute incoming commands from remote controller
  useEffect(() => {
    const interval = setInterval(async () => {
      if (videoError) return;
      if (mediaType === 'video' && !videoRef.current) return;

      try {
        const res = await fetch(`/api/remote/${id}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.commands && data.commands.length > 0) {
          for (const cmd of data.commands) {
            switch (cmd.command) {
              case 'play':
                if (mediaType === 'video' && videoRef.current) {
                  videoRef.current.play().catch(() => {});
                }
                setPlaying(true);
                break;
              case 'pause':
                if (mediaType === 'video' && videoRef.current) {
                  videoRef.current.pause();
                }
                setPlaying(false);
                break;
              case 'seek':
                if (mediaType === 'video' && videoRef.current) {
                  videoRef.current.currentTime = Number(cmd.value);
                  setCurrentTime(Number(cmd.value));
                } else {
                  setCurrentTime(Number(cmd.value));
                }
                break;
              case 'volume':
                if (mediaType === 'video' && videoRef.current) {
                  const volVal = Number(cmd.value);
                  videoRef.current.volume = volVal;
                  setVolume(volVal);
                  setMuted(volVal === 0);
                }
                break;
              case 'mute':
                if (mediaType === 'video' && videoRef.current) {
                  videoRef.current.muted = true;
                  setMuted(true);
                }
                break;
              case 'unmute':
                if (mediaType === 'video' && videoRef.current) {
                  videoRef.current.muted = false;
                  setMuted(false);
                }
                break;
              case 'fullscreen':
                toggleFullscreen();
                break;
              case 'subtitles':
                if (mediaType === 'video') {
                  toggleSubtitles();
                }
                break;
              case 'next_image':
                if (mediaType === 'image') {
                  navigateImage('next');
                }
                break;
              case 'prev_image':
                if (mediaType === 'image') {
                  navigateImage('prev');
                }
                break;
              case 'back':
                router.push('/');
                break;
            }
            resetControlsTimeout();
          }
        }
      } catch (err) {
        // ignore
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [id, videoError, mediaType, duration]);

  // Video Source URL
  const videoSrc = `/api/stream/${id}`;

  // Controls Visibility Timeout
  const resetControlsTimeout = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (stateRef.current.playing) {
        setControlsVisible(false);
      }
    }, 2500) as unknown as number;
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [playing]);

  const handleMouseMove = () => {
    resetControlsTimeout();
  };

  // Video State Handlers
  const handlePlayPause = () => {
    if (mediaType === 'video') {
      if (!videoRef.current) return;
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    } else {
      setPlaying(!playing);
    }
  };

  const handleTimeUpdate = () => {
    if (mediaType === 'video' && videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (mediaType === 'video' && videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    if (mediaType === 'video' && !videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    const newTime = percentage * duration;
    if (mediaType === 'video' && videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (mediaType !== 'video' || !videoRef.current) return;
    const val = parseFloat(e.target.value);
    videoRef.current.volume = val;
    setVolume(val);
    setMuted(val === 0);
  };

  const toggleMute = () => {
    if (mediaType !== 'video' || !videoRef.current) return;
    const newMute = !muted;
    videoRef.current.muted = newMute;
    setMuted(newMute);
  };

  const toggleSubtitles = () => {
    if (!videoRef.current || videoRef.current.textTracks.length === 0) return;
    const track = videoRef.current.textTracks[0];
    if (track.mode === 'showing') {
      track.mode = 'hidden';
      setSubtitlesVisible(false);
    } else {
      track.mode = 'showing';
      setSubtitlesVisible(true);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  // Keyboard Event Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mediaType === 'video' && !videoRef.current) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          if (mediaType === 'video' && videoRef.current) {
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
          } else if (mediaType === 'image') {
            navigateImage('prev');
          }
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          if (mediaType === 'video' && videoRef.current) {
            videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
          } else if (mediaType === 'image') {
            navigateImage('next');
          }
          break;
        case 'arrowup':
          e.preventDefault();
          if (mediaType === 'video' && videoRef.current) {
            const nextVolUp = Math.min(1, videoRef.current.volume + 0.1);
            videoRef.current.volume = nextVolUp;
            setVolume(nextVolUp);
            setMuted(nextVolUp === 0);
          }
          resetControlsTimeout();
          break;
        case 'arrowdown':
          e.preventDefault();
          if (mediaType === 'video' && videoRef.current) {
            const nextVolDown = Math.max(0, videoRef.current.volume - 0.1);
            videoRef.current.volume = nextVolDown;
            setVolume(nextVolDown);
            setMuted(nextVolDown === 0);
          }
          resetControlsTimeout();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'c':
          e.preventDefault();
          if (mediaType === 'video') {
            toggleSubtitles();
          }
          break;
        case 'm':
          e.preventDefault();
          if (mediaType === 'video') {
            toggleMute();
          }
          break;
        case 'escape':
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
            setIsFullscreen(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duration, playing, muted, mediaType]);

  // Video Error Handler
  const handleVideoError = () => {
    if (!videoRef.current) return;
    const error = videoRef.current.error;
    let errorMsg = 'An unknown video error occurred.';
    if (error) {
      switch (error.code) {
        case 1:
          errorMsg = 'Video loading aborted by browser.';
          break;
        case 2:
          errorMsg = 'Network error occurred while fetching video chunks.';
          break;
        case 3:
          errorMsg = 'Video decoding failed. The format/codec might not be supported by this browser (e.g. MKV H.265/AC3).';
          break;
        case 4:
          errorMsg = 'The video format or codec is not supported by your browser.';
          break;
      }
    }
    setVideoError(errorMsg);
  };

  return (
    <div className="flex flex-1 flex-col bg-black text-zinc-150">
      {/* Immersive Video Screen */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className={`relative flex flex-1 items-center justify-center bg-black select-none ${
          !controlsVisible && playing ? 'cursor-none' : 'cursor-default'
        }`}
        style={{ height: 'calc(100vh - 64px)' }}
      >
        {videoError ? (
          <div className="max-w-md border border-zinc-800 bg-zinc-950 p-6 rounded-md text-center">
            <svg
              className="mx-auto h-12 w-12 text-red-500 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h3 className="text-sm font-semibold text-zinc-200">Playback Failed</h3>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{videoError}</p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                onClick={() => router.back()}
                className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-200 rounded-md transition-colors"
              >
                Back to Library
              </button>
              <button
                onClick={() => {
                  setVideoError(null);
                  if (videoRef.current) {
                    videoRef.current.load();
                    videoRef.current.play().catch(() => {});
                  }
                }}
                className="bg-zinc-100 hover:bg-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-950 rounded-md transition-colors"
              >
                Retry Playback
              </button>
            </div>
            <p className="mt-4 text-[10px] text-zinc-650">
              Note: Un-transcoded H.265/MKV audio or video codecs are often unsupported natively in browsers. Consider using Chrome or Safari if you experience decoding problems.
            </p>
          </div>
        ) : (
          mediaType === 'video' ? (
            <video
              ref={videoRef}
              src={videoSrc}
              autoPlay
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onError={handleVideoError}
              onClick={handlePlayPause}
              onDoubleClick={toggleFullscreen}
              className="h-full w-full object-contain max-h-screen"
            >
              {hasSubtitles && (
                <track
                  src={`/api/subtitles/${id}`}
                  kind="subtitles"
                  srcLang="en"
                  label="English"
                  default
                />
              )}
            </video>
          ) : (
            <img
              src={`/api/media/image/${id}`}
              alt={videoName}
              onClick={handlePlayPause}
              onDoubleClick={toggleFullscreen}
              className="h-full w-full object-contain max-h-screen select-none"
            />
          )
        )}

        {/* Custom Overlaid Video Controls */}
        <div
          className={`absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent p-6 transition-all duration-300 ${
            controlsVisible || !playing ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          {/* Timeline Seekbar */}
          <div className="mb-4 group/seekbar cursor-pointer" onClick={handleSeek}>
            <div className="relative h-1.5 w-full bg-zinc-800 rounded-full group-hover/seekbar:h-2 transition-all">
              <div
                className="absolute left-0 top-0 h-full bg-zinc-200 rounded-full"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Buttons & Indicators */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {mediaType === 'image' && (
                <button
                  onClick={() => navigateImage('prev')}
                  className="text-zinc-350 hover:text-zinc-100 transition-colors"
                  title="Previous Image (Left Arrow)"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}

              {/* Play / Pause */}
              <button
                onClick={handlePlayPause}
                className="text-zinc-350 hover:text-zinc-100 transition-colors"
                title={mediaType === 'video' ? (playing ? 'Pause (Space)' : 'Play (Space)') : (playing ? 'Pause Slideshow (Space)' : 'Play Slideshow (Space)')}
              >
                {playing ? (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {mediaType === 'image' && (
                <button
                  onClick={() => navigateImage('next')}
                  className="text-zinc-350 hover:text-zinc-100 transition-colors"
                  title="Next Image (Right Arrow)"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              {/* Volume Controller */}
              {mediaType === 'video' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMute}
                    className="text-zinc-350 hover:text-zinc-100 transition-colors"
                    title={muted ? 'Unmute (M)' : 'Mute (M)'}
                  >
                    {muted || volume === 0 ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                        />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                        />
                      </svg>
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={muted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-200"
                    style={{ outline: 'none' }}
                  />
                </div>
              )}

              {/* Time Indicators */}
              <div className="text-xs font-mono text-zinc-400">
                {mediaType === 'video' ? (
                  <>
                    {formatTime(currentTime)} <span className="text-zinc-650 font-sans">/</span> {formatTime(duration)}
                  </>
                ) : (
                  <>
                    Slide Progress <span className="text-zinc-650 font-sans">({Math.round(currentTime)}s / 5s)</span>
                  </>
                )}
              </div>
            </div>

            {/* Video File Name */}
            <div className="hidden lg:block max-w-sm truncate text-xs font-mono text-zinc-400" title={videoName}>
              {videoName}
            </div>

            <div className="flex items-center gap-3">
              {/* Subtitles (CC) Button */}
              {hasSubtitles && (
                <button
                  onClick={toggleSubtitles}
                  className={`transition-colors shrink-0 ${
                    subtitlesVisible ? 'text-zinc-255 hover:text-zinc-50' : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                  title="Subtitles (C)"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth={1.8} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 10h2M7 14h4M13 10h4M13 14h2" />
                  </svg>
                </button>
              )}

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="text-zinc-350 hover:text-zinc-100 transition-colors"
                title="Fullscreen (F)"
              >
                {isFullscreen ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8V4a3 3 0 00-3-3H7a3 3 0 00-3 3v4m0 0h16"
                    />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V5a2 2 0 012-2h2M3 16v3a2 2 0 002 2h3m8-18h3a2 2 0 012 2v3m-2 11v3a2 2 0 01-2 2h-3"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Resume Prompt Toast */}
        {showResumePrompt && resumeTime && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 border border-zinc-850 bg-zinc-950 p-4 rounded-md shadow-lg max-w-sm w-full flex flex-col gap-3 transition-all duration-300">
            <div className="text-center sm:text-left">
              <h5 className="text-xs font-semibold text-zinc-200">Resume Playback?</h5>
              <p className="text-[11px] text-zinc-550 mt-1 font-mono">
                You previously watched up to <span className="text-zinc-300 font-semibold">{formatTime(resumeTime)}</span>.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleStartOver}
                className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-[10px] font-mono font-semibold py-1.5 px-3 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Start Over
              </button>
              <button
                onClick={handleResumePlayback}
                className="bg-zinc-200 hover:bg-zinc-100 text-[10px] font-mono font-semibold py-1.5 px-3 rounded text-zinc-950 transition-colors"
              >
                Resume ({formatTime(resumeTime)})
              </button>
            </div>
          </div>
        )}

        {/* Floating Top Header Back Button */}
        <div
          className={`absolute top-0 inset-x-0 z-10 p-6 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between transition-all duration-300 ${
            controlsVisible || !playing ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
          }`}
        >
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-850 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-zinc-100 rounded-md transition-all shadow"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Library
          </button>

          <span className="text-xs font-mono text-zinc-400 select-none block lg:hidden max-w-[200px] truncate">
            {videoName}
          </span>

          <button
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-2 border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-850 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-zinc-100 rounded-md transition-all shadow"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Play on TV
          </button>
        </div>
      </div>

      {shareOpen && (
        <ShareTvModal
          videoName={videoName}
          videoUrl={(() => {
            const port = typeof window !== 'undefined' ? window.location.port : '3000';
            const cleanPort = port ? `:${port}` : '';
            return `http://${hostIp}${cleanPort}/player/${id}`;
          })()}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
