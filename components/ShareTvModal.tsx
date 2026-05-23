'use client';

import React, { useState } from 'react';

interface ShareTvModalProps {
  videoName: string;
  videoUrl: string;
  onClose: () => void;
}

export default function ShareTvModal({ videoName, videoUrl, onClose }: ShareTvModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(videoUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    videoUrl
  )}&color=228-228-231&bgcolor=24-24-27`; // matches zinc text color and dark background

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm border border-zinc-800 bg-zinc-900 p-6 rounded-md shadow-lg text-center">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Play on TV / Device</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mb-2 text-sm font-medium text-zinc-100 truncate" title={videoName}>
          {videoName}
        </p>

        {/* QR Code Container */}
        <div className="mx-auto my-5 flex h-48 w-48 items-center justify-center bg-zinc-950 border border-zinc-800 rounded p-3">
          <img
            src={qrImageUrl}
            alt="TV QR Code Link"
            width={200}
            height={200}
            className="h-full w-full object-contain"
          />
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed px-4">
          Scan this QR Code with your phone, tablet, or TV camera to open the player instantly.
        </p>

        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-2 border border-zinc-800 bg-zinc-950 p-2 rounded-md font-mono text-xs select-all text-zinc-350">
            <span className="truncate flex-1 text-left">{videoUrl}</span>
            <button
              onClick={handleCopy}
              className="text-zinc-500 hover:text-zinc-300 transition-colors px-1 shrink-0"
              title="Copy link"
            >
              {copied ? (
                <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-2 4h.01M9 16h5m-5-4h5"
                  />
                </svg>
              )}
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 py-2 text-xs font-semibold text-zinc-200 rounded-md transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
