# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Desktop DICOM viewer built with Electron + TypeScript + React + Cornerstone3D. Features: open DICOM files, zoom/pan/rotate/window-level, metadata inspection, cine (video) playback of image stacks.

## Commands

```bash
npm run dev          # start Electron in dev mode (hot reload via electron-vite)
npm run build        # compile TS + bundle all three targets (main/preload/renderer)
npm run package      # build then electron-builder distributable
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
```

## Architecture

Electron splits into two processes. Keep this boundary hard: no Node/Electron APIs in renderer code, no Cornerstone in main.

### Main process (`src/main/`)
- `main.ts` — creates `BrowserWindow`, native menu, registers IPC handlers
- `fileHandler.ts` — `dialog.showOpenDialog` + `fs.readFile` → returns `DicomFileData[]` with `ArrayBuffer`
- `ipc.ts` — all `ipcMain.handle` registrations; single source of truth for IPC logic

### Preload (`src/preload/`)
- `preload.ts` — `contextBridge.exposeInMainWorld('api', ...)` typed bridge. Never expose raw `ipcRenderer`.

### Shared (`src/shared/`)
- `ipcChannels.ts` — channel name constants; import from both main and preload, never use magic strings
- `types.ts` — `DicomFileData` interface shared across the process boundary

### Renderer (`src/renderer/`)
React SPA. State managed by Zustand in `store/index.ts`.

- `App.tsx` — root layout: `<Toolbar>` + `<Viewport>` + `<CinePlayer>` overlay + `<MetadataPanel>`
- `components/Viewport.tsx` — owns the Cornerstone3D `RenderingEngine`. Creates it on mount, destroys on unmount. Two effects: one reloads the full stack when `imageIds` change, one navigates frames when `currentImageIndex` changes.
- `components/CinePlayer.tsx` — appears only when `imageIds.length > 1`. Drives playback via `setInterval` advancing `currentImageIndex` in the store. Also has a scrubber and fps control.
- `components/MetadataPanel.tsx` — searchable table of known DICOM tags from `store.metadata`.
- `components/Toolbar.tsx` — Open button + tool selector buttons (W/L, Pan, Zoom, Rotate).

### DICOM rendering (`src/renderer/cornerstone/`)
- `init.ts` — calls `csInit()`, `csToolsInit()`, registers the local image loader, registers tools. Called once before React mounts.
- `localImageLoader.ts` — custom Cornerstone3D image loader (`dicomlocal:` scheme). Stores `ArrayBuffer` by imageId in a module-level `Map`. Decodes uncompressed pixel data using `dicom-parser`. **Note:** `@cornerstonejs/dicom-image-loader` is intentionally not used — its IIFE-format codec workers conflict with Vite's code-splitting bundler. To support compressed DICOM (JPEG, JPEG-LS, JPEG 2000), either resolve that Vite conflict or switch to a webpack renderer build.
- `tools.ts` — registers and configures tool groups. Active tools: `WindowLevelTool` (primary), `PanTool` (middle), `ZoomTool` (right), `StackScrollTool` (wheel). `setActivePrimaryTool(name)` re-binds left-click.
- `viewportRef.ts` — module-level `HTMLDivElement | null` set by `Viewport` on mount. Provides access to the viewport DOM element for any sibling component that needs it.

## Key libraries

| Library | Role |
|---|---|
| `@cornerstonejs/core` | Rendering engine, `IStackViewport`, image cache |
| `@cornerstonejs/tools` | Tool classes: `WindowLevelTool`, `PanTool`, `ZoomTool`, `PlanarRotateTool`, `StackScrollTool` |
| `dicom-parser` | Raw DICOM byte parsing; used for pixel extraction and metadata |
| `zustand` | Renderer app state (imageIds, current frame, metadata, playback) |
| `electron-builder` | Package / distribute |
| `electron-vite` | Build tool: handles main / preload (SSR/CJS) + renderer (Vite ESM) in one config |

## DICOM file flow

1. User clicks Open or File > Open → `window.api.openFiles()` → IPC → main shows dialog → reads files → returns `DicomFileData[]` (ArrayBuffers transferred via structured clone)
2. Store `loadFiles()`: sorts by Instance Number (tag `x00200013`), calls `storeBuffer(buffer)` for each → returns `dicomlocal:<n>` imageId, extracts known metadata tags
3. `Viewport` effect: `viewport.setStack(imageIds, 0)` → Cornerstone calls the local loader → `dicom-parser` extracts pixel data → viewport renders

## Cornerstone3D tool names (v2 API)

`RotateTool` and `StackScrollMouseWheelTool` do not exist in Cornerstone3D v2. Use:
- `PlanarRotateTool` (toolName: `'PlanarRotate'`)
- `StackScrollTool` with `MouseBindings.Wheel` binding (toolName: `'StackScroll'`)
