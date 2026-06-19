# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Desktop DICOM viewer built with Electron + TypeScript + Cornerstone3D. Features: open DICOM files, zoom/pan/rotate/window-level, metadata inspection, cine (video) playback of image stacks.

## Commands

```bash
npm install          # install deps
npm run dev          # start Electron in dev mode (hot reload)
npm run build        # compile TS + bundle renderer
npm run package      # package into distributable (electron-builder)
npm test             # run tests
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
```

Run a single test:
```bash
npm test -- --testPathPattern=<filename>
```

## Architecture

Electron splits into two processes. Keep this boundary respected — do not import Node/Electron APIs in renderer code and do not import Cornerstone in main.

### Main process (`src/main/`)
- Entry: `main.ts` — creates `BrowserWindow`, registers IPC handlers, sets up native menu
- `fileHandler.ts` — opens file dialogs, reads DICOM files from disk via `fs`, sends buffers to renderer over IPC
- `ipc.ts` — all `ipcMain.handle` channel definitions live here

### Preload (`src/preload/`)
- `preload.ts` — exposes a typed `window.api` bridge using `contextBridge`. Only surface what renderer needs; never expose raw `ipcRenderer`.

### Renderer (`src/renderer/`)
React SPA served inside the Electron window.

- `App.tsx` — root layout: toolbar, viewport area, metadata panel
- `components/Viewport.tsx` — owns the Cornerstone3D canvas element. Initializes the rendering engine on mount, tears it down on unmount.
- `components/MetadataPanel.tsx` — reads DICOM tags from loaded image metadata; displays in a searchable table
- `components/CinePlayer.tsx` — controls for stack playback (play/pause/speed); drives Cornerstone3D's `StackScrollTool` or cine utilities
- `store/` — Zustand (or Redux Toolkit) for app state: loaded series, active viewport tools, playback state

### DICOM rendering (`src/renderer/cornerstone/`)
- `init.ts` — calls `cornerstone3D.init()`, registers `cornerstoneWADOImageLoader` with Web Workers
- `loaders.ts` — registers the local file loader (`dicomfile:` scheme) that converts `ArrayBuffer` received from main process into a Cornerstone3D image ID
- `tools.ts` — registers and activates tools: `ZoomTool`, `PanTool`, `RotateTool`, `WindowLevelTool`, `StackScrollMouseWheelTool`

## Key libraries

| Library | Role |
|---|---|
| `@cornerstonejs/core` | Rendering engine, viewports, image cache |
| `@cornerstonejs/tools` | Zoom, pan, rotate, W/L, stack scroll |
| `cornerstone-wado-image-loader` | Decode DICOM pixel data (uses web workers) |
| `dicom-parser` | Parse raw DICOM bytes → dataset; used for metadata extraction |
| `electron-builder` | Package/distribute the app |
| `react` / `react-dom` | Renderer UI |

## IPC channels

Define channel name constants in `src/shared/ipcChannels.ts` (imported by both main and preload). Never use magic strings in call sites.

## DICOM file flow

1. User opens file → main process reads bytes via `fs.readFile` → sends `ArrayBuffer` over IPC
2. Renderer receives buffer → registers it with the local image loader under a unique `imageId`
3. Cornerstone3D loads `imageId` → decodes pixel data via WADO image loader web worker
4. Viewport displays image; metadata extracted from `dicom-parser` dataset displayed in panel

## Cine / stack video

Use Cornerstone3D's built-in `utilities.cine` module. Store current frame index in app state; the `CinePlayer` component drives `setImageIdIndex` on the viewport. Do not re-initialize the rendering engine between frames.
