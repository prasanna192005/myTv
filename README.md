# myTV

A fast, seekable, dependency-free local network media streamer built with Next.js 16 and Tailwind CSS v4. It indexes video files from your computer and streams them to any smart TV, phone, tablet, or web browser on your home network with full support for scrub seeking (HTTP Range requests) and a dedicated mobile remote controller.

---

## Key Features

- **HTTP Range Requests (206 Partial Content)**: Custom stream engine built on Node.js streams. Handles seeking on massive files (20GB+) smoothly without buffering or crashing the server.
- **Phone Remote Control & Keyboard**: Scan a QR code on your TV, use your mobile keyboard to search your video library, tap to cast instantly to the TV browser, and control playback parameters (seek, volume, mute, fullscreen) remotely.
- **Directory History & Switcher**: Add and scan any local folders (e.g. `D:\Movies`, `C:\Users\Videos`). Persists a history of up to 10 folders for fast, single-click library switching.
- **Automated Subtitle Processing**: Scans directory for companion `.srt` or `.vtt` files next to videos. Automatically parses and converts SRT subtitles to WebVTT format on-the-fly, with toggle visibility synced between physical keyboards (`C` hotkey) and the mobile remote controller.
- **Movie Poster Thumbnails**: Scans for companion image files next to videos (or default folder `poster.jpg`/`folder.jpg` metadata) to create a visual thumbnail card grid.
- **Standalone Photo Slideshows**: Indexes standalone image files (JPEG, PNG, WEBP, GIF), displays them as high-resolution slideshows on the TV screen, and allows control (previous/next slide, play/pause) from your smartphone remote.
- **Quick Filtering & Search**: Instant searching, sorting by name/size, format filtering, and automatic subdirectory grouping.
- **Touch & Keyboard Playback**: Fully customizable theater player supporting mobile touch controls and rich keyboard shortcuts.
- **Secure Local Sandbox**: Restricts video access explicitly to your configured directories to prevent directory traversal attacks.
- **Clean & Simple**: Zero cloud dependencies, zero external database setup, zero FFmpeg complexity. Runs completely offline.

---

## Tech Stack & Conventions

- **Framework**: Next.js 16 (App Router, fully dynamic routes, async route/page context params)
- **Runtime**: React 19.2 (using Canary state Hooks like `use()` for promise-based page parameters)
- **Styling**: Tailwind CSS v4 (flat, high-contrast, minimal dark developer theme)
- **API Engine**: Next.js Route Handlers leveraging Node.js `fs`, `os` network interfaces, and Web `Response` with `Readable.toWeb` streams.

---

## Project Architecture

```
├── app/
│   ├── api/
│   │   ├── config/             # Reads and updates media directory path
│   │   ├── videos/             # Triggers recursive scan & serves library
│   │   ├── stream/[id]/        # Chunked HTTP Range video streaming server
│   │   ├── subtitles/[id]/     # Dynamic SRT-to-WebVTT parser & subtitle server
│   │   ├── media/image/[id]/   # Dynamic secure image server (photos and posters)
│   │   └── remote/             # Pairing command queues and state sync endpoints
│   ├── player/[id]/            # Immersive custom video player page (TV / Client)
│   ├── remote/                 # Client phone remote controller view
│   ├── globals.css             # High-contrast dark theme stylesheet
│   ├── layout.tsx              # Metadata, HTML root, and default layout configuration
│   └── page.tsx                # Main library dashboard & TV poller
├── components/
│   ├── SettingsModal.tsx       # Folder configuration & switcher history
│   ├── ShareTvModal.tsx        # TV sharing URL & QR code generator
│   └── VideoGrid.tsx           # Video listing, sorting, and search bar
├── lib/
│   ├── config.ts               # Local config loader (mytv-config.json)
│   ├── ip.ts                   # Physical network IP auto-discover utility
│   ├── remote-store.ts         # Remote pairing state & command buffer (in-memory)
│   └── videos.ts               # Recursive video directory walk engine
```

---

## Getting Started

### 1. Installation
Clone the repository, navigate to the folder, and install dependencies:
```bash
npm install
```

### 2. Run the Server
Start the development server. The project is pre-configured to bind to all network interfaces (`0.0.0.0`) so other devices on your Wi-Fi can connect:
```bash
npm run dev
```

### 3. Open the App
- **Host computer**: Open [http://localhost:3000](http://localhost:3000)
- **On your TV / Network Devices**: Look at the header of the host page for your physical network URL (e.g. `http://192.168.1.100:3000`). Type this URL into your TV browser.

---

## Pairing Your Phone Remote

Once the homepage is loaded on your TV, you never need to type links or search with your TV remote again:
1. Click **Phone Remote** in your TV header.
2. Scan the displayed **QR Code** with your smartphone.
3. Tap the search bar on your phone to filter titles using your mobile keyboard.
4. Tap any video in the list on your phone, and it will automatically open and play on the TV screen!
5. The phone remote will instantly transform into a touch playback controller.

---

## Pro Tips & Networking

### Eliminate Port `:3000` (Port 80 Trick)
Typing the colon (`:`) and port number (`3000`) is the most tedious part on a TV remote. You can bind the app to the default HTTP Port `80`:
```bash
npm run dev -- --port 80
```
Now, you only have to type your simple IP address (e.g. `192.168.1.100`) directly into the TV's address bar. No ports, no symbols!

### Windows Defender Firewall
If other devices on your Wi-Fi fail to open the links, Windows Defender Firewall might be blocking incoming traffic:
1. Search for **"Allow an app through Windows Firewall"** in the Windows Start menu.
2. Click **Change Settings**.
3. Locate **Node.js JavaScript Runtime** and ensure both **Private** and **Public** checkboxes are ticked.

### Browser Codec Limitations
Since this is a lightweight streamer with no transcoding servers (no high-CPU FFmpeg requirements), videos are streamed in their raw format. 
- **Supported codecs**: The client browser must support the video/audio container codecs natively (H.264 video with AAC audio is universally supported in `.mp4`/`.mkv`/`.webm`).
- **Unsupported codecs**: High-overhead formats (like HEVC/H.265 video or Dolby DTS/AC3 audio) might fail to decode or play audio depending on your TV/client browser. We recommend using Chrome or Safari if you experience playback issues, or converting files to H.264/AAC.

---

## Player Keyboard Shortcuts

When watching videos directly on your computer, you can fully control the player using keyboard shortcuts:

| Key | Action |
| --- | --- |
| `Space` / `K` | Play / Pause |
| `Left Arrow` / `J` | Seek Backward 10 seconds |
| `Right Arrow` / `L` | Seek Forward 10 seconds |
| `Up Arrow` | Volume Up 10% |
| `Down Arrow` | Volume Down 10% |
| `F` | Toggle Fullscreen |
| `C` | Toggle Subtitles |
| `M` | Toggle Mute |
| `Esc` | Exit Fullscreen |
