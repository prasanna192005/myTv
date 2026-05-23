'use client';

import React, { useState } from 'react';

interface SettingsModalProps {
  currentPath: string;
  recentPaths: string[];
  onClose: () => void;
  onSave: (newPath: string) => void;
}

export default function SettingsModal({ currentPath, recentPaths, onClose, onSave }: SettingsModalProps) {
  const [pathValue, setPathValue] = useState(currentPath);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mediaDirectory: pathValue }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update directory');
      }

      onSave(pathValue);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg border border-zinc-800 bg-zinc-900 p-6 rounded-md shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Library Configuration</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-2">
              Media Directory (Absolute Path)
            </label>
            <input
              type="text"
              value={pathValue}
              onChange={(e) => setPathValue(e.target.value)}
              placeholder="e.g., C:\Users\Username\Videos"
              className="w-full border border-zinc-850 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-650 rounded-md focus:outline-none focus:border-zinc-750"
              required
            />
            <p className="mt-1 text-xs text-zinc-500">
              The application scans this folder recursively for video files.
            </p>
          </div>

          {recentPaths && recentPaths.length > 0 && (
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-2">
                Recent Folders
              </label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto border border-zinc-850 bg-zinc-950 p-2 rounded-md">
                {recentPaths.map((path) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => setPathValue(path)}
                    className={`w-full text-left text-xs font-mono px-2 py-1 rounded truncate transition-colors flex items-center justify-between ${
                      pathValue.toLowerCase() === path.toLowerCase()
                        ? 'bg-zinc-800 text-zinc-100 font-semibold'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    }`}
                  >
                    <span className="truncate pr-4">{path}</span>
                    {pathValue.toLowerCase() === path.toLowerCase() && (
                      <span className="text-[9px] text-zinc-400 border border-zinc-750 px-1 rounded bg-zinc-900 shrink-0 uppercase">Active</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="border border-red-900/50 bg-red-950/20 px-3 py-2 text-xs text-red-400 rounded-md">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 px-4 py-2 text-sm font-medium text-zinc-300 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-zinc-100 hover:bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-950 rounded-md transition-colors disabled:opacity-50"
            >
              {loading ? 'Validating...' : 'Save Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
