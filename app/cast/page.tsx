'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function CastPage() {
  const [status, setStatus] = useState<'idle' | 'capturing' | 'signaling' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [hostIp, setHostIp] = useState('127.0.0.1');
  const [port, setPort] = useState('3000');
  const [streamAudio, setStreamAudio] = useState(true);
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Get host configuration
    fetch('/api/config', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.hostIp) {
          setHostIp(data.hostIp);
        }
      })
      .catch((err) => console.error('Failed to get host IP:', err));

    if (typeof window !== 'undefined') {
      setPort(window.location.port || '3000');
    }

    return () => {
      stopCasting();
    };
  }, []);

  const startCasting = async () => {
    try {
      setStatus('capturing');
      setErrorMessage('');

      // 1. Get Display Media (Screen/Tab capture)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: streamAudio ? {
          echoCancellation: true,
          noiseSuppression: true,
        } : false,
      });

      localStreamRef.current = stream;
      
      // Bind preview video
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
      }

      // Handle when user clicks "Stop Sharing" on the native browser bar
      stream.getVideoTracks()[0].onended = () => {
        stopCasting();
      };

      setStatus('signaling');

      // 2. Initialize RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      peerConnectionRef.current = pc;

      // 3. Add tracks to PeerConnection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.onconnectionstatechange = () => {
        console.log('Sender connection state change:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setStatus('connected');
        } else if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          setStatus('capturing'); // Revert back to local streaming status
        }
      };

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          // Send ICE candidates to receiver
          try {
            await fetch('/api/webrtc/cast-sender', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'candidate', payload: event.candidate }),
            });
          } catch (e) {
            console.error('Failed to send ICE candidate:', e);
          }
        }
      };

      // Clear any prior signaling messages
      try {
        await fetch('/api/webrtc/cast-sender', { cache: 'no-store' });
        await fetch('/api/webrtc/cast-receiver', { cache: 'no-store' });
      } catch (e) {}

      // 4. Create WebRTC SDP Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 5. Send Offer
      await fetch('/api/webrtc/cast-sender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'offer', payload: offer }),
      });

      // 6. Poll for Answer & Candidates from TV (Receiver)
      let active = true;
      pollingIntervalRef.current = window.setInterval(async () => {
        if (!active) return;
        try {
          const res = await fetch('/api/webrtc/cast-receiver', { cache: 'no-store' });
          if (!res.ok) return;
          const data = await res.json();
          if (data.signals && data.signals.length > 0) {
            for (const sig of data.signals) {
              if (sig.type === 'answer') {
                console.log('Received answer from TV');
                await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
                setStatus('connected');
              } else if (sig.type === 'candidate') {
                console.log('Received ICE candidate from TV');
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(sig.payload));
                } catch (e) {
                  console.error('Error adding ICE candidate', e);
                }
              }
            }
          }
        } catch (e) {
          console.error('Signaling poll error:', e);
        }
      }, 1000) as unknown as number;

      // Automatically trigger TV redirect to cast viewer
      try {
        await fetch('/api/remote/tv-screen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: 'open_video', value: 'cast' }),
        });
      } catch (e) {
        console.error('Failed to command TV to open cast screen:', e);
      }

    } catch (err: any) {
      console.error('Casting failed:', err);
      setErrorMessage(err.message || 'Permission denied or browser error.');
      setStatus('error');
      stopCasting();
    }
  };

  const stopCasting = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }

    setStatus('idle');
  };

  const getTvUrl = () => {
    return `http://${hostIp}:${port}/player/cast`;
  };

  return (
    <div className="flex flex-1 flex-col bg-zinc-950 text-zinc-100 max-w-md mx-auto w-full border-x border-zinc-900 min-h-screen p-6 select-none font-sans">
      {/* Header */}
      <div className="border-b border-zinc-900 pb-5 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-md font-bold tracking-tight text-zinc-200 font-mono">myTV Screen Cast</h1>
          <p className="text-xs text-zinc-500 mt-1">Cast your laptop screen or tab to the TV.</p>
        </div>
        <Link
          href="/"
          className="border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 px-2.5 py-1.5 text-[10px] font-medium font-mono text-zinc-400 rounded transition-colors"
        >
          Library
        </Link>
      </div>

      {/* Connection Guide */}
      <div className="mb-6 border border-zinc-850 bg-zinc-900/40 p-4 rounded-md text-xs leading-relaxed space-y-2">
        <p className="font-semibold text-zinc-300 flex items-center gap-1.5 font-mono text-[11px]">
          <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Quick Guide:
        </p>
        <ul className="list-decimal pl-4 text-zinc-400 space-y-1">
          <li>Ensure your TV player page is open at <span className="font-mono text-zinc-250 select-all underline">{getTvUrl()}</span>.</li>
          <li>Click the button below to select the tab or screen you wish to share.</li>
          <li>Keep this browser tab open to sustain the live feed.</li>
        </ul>
      </div>

      {/* Settings Panel */}
      {status === 'idle' && (
        <div className="mb-6 border border-zinc-900 bg-zinc-950 p-4 rounded-md space-y-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">Casting Options</h3>
          
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={streamAudio}
              onChange={(e) => setStreamAudio(e.target.checked)}
              className="h-4.5 w-4.5 border border-zinc-800 rounded bg-zinc-900 accent-zinc-200"
            />
            <div className="text-xs">
              <span className="block font-semibold text-zinc-300 group-hover:text-zinc-200">Include Tab Audio</span>
              <span className="block text-[10px] text-zinc-550 mt-0.5">Stream tab audio to the TV speakers (Chrome only).</span>
            </div>
          </label>
        </div>
      )}

      {/* Main Casting Action Area */}
      <div className="flex-1 flex flex-col justify-center items-center py-6 gap-6">
        {/* Status Indicator */}
        <div className="flex flex-col items-center gap-2">
          {status === 'idle' && (
            <span className="bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full">
              Ready to Share
            </span>
          )}
          {status === 'capturing' && (
            <span className="bg-amber-950/20 border border-amber-900 text-amber-500 font-mono text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full animate-pulse">
              Selecting Stream Source...
            </span>
          )}
          {status === 'signaling' && (
            <span className="bg-blue-950/20 border border-blue-900 text-blue-500 font-mono text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full animate-pulse">
              Connecting to TV...
            </span>
          )}
          {status === 'connected' && (
            <span className="bg-green-950/20 border border-green-900 text-green-500 font-mono text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-ping" />
              Live Casting Active
            </span>
          )}
          {status === 'error' && (
            <span className="bg-red-950/20 border border-red-900 text-red-500 font-mono text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full">
              Casting Error
            </span>
          )}

          {errorMessage && (
            <p className="text-[11px] text-red-400 max-w-xs text-center font-mono mt-1">
              Error: {errorMessage}
            </p>
          )}
        </div>

        {/* Big Cast Toggle Button */}
        {status === 'idle' || status === 'error' ? (
          <button
            onClick={startCasting}
            className="h-32 w-32 rounded-full border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <svg className="h-10 w-10 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="text-[10px] font-bold tracking-wider font-mono text-zinc-400 uppercase">Share Screen</span>
          </button>
        ) : (
          <button
            onClick={stopCasting}
            className="h-32 w-32 rounded-full border border-red-900 bg-red-950/20 hover:bg-red-950/30 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <svg className="h-10 w-10 text-red-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="text-[10px] font-bold tracking-wider font-mono text-red-400 uppercase">Stop Casting</span>
          </button>
        )}

        {/* Live Preview Monitor */}
        {(status === 'connected' || status === 'signaling' || status === 'capturing') && (
          <div className="w-full aspect-video border border-zinc-900 bg-black rounded-md overflow-hidden relative shadow-md">
            <video
              ref={previewVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-contain"
            />
            <div className="absolute top-2 left-2 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-mono tracking-widest text-zinc-400 uppercase">
              Local Preview Monitor (Muted)
            </div>
          </div>
        )}
      </div>

      {/* Footer link to player */}
      <div className="text-center pt-4 border-t border-zinc-900">
        <a
          href={getTvUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-mono text-zinc-550 hover:text-zinc-400 transition-colors"
        >
          Open TV Screen Receiver in new tab &rarr;
        </a>
      </div>
    </div>
  );
}
