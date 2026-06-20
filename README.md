# DICOM Viewer

A desktop application for viewing and inspecting DICOM medical images. Built with Electron, React, TypeScript, and Cornerstone3D.

## Features

- Open single DICOM files or entire folders of DICOM files
- Multi-frame DICOM and image stack support with cine (video) playback
- Interactive image manipulation: window/level, pan, zoom, rotate
- Named window/level presets: Brain, Soft Tissue, Abdomen, Lung, Bone
- Hounsfield Unit (HU) readout — value under cursor shown as overlay
- Export current viewport frame as PNG
- Multi-Planar Reconstruction (MPR) — axial, sagittal, and coronal views for CT series
- Mouse wheel stack navigation
- DICOM metadata inspection panel with searchable tag table
- Debug log panel
- Cross-platform: Windows, macOS, Linux

## Supported DICOM Files

Supports uncompressed transfer syntaxes (Explicit/Implicit VR Little Endian) as well as compressed formats (JPEG Baseline, JPEG-LS, JPEG 2000) via `@cornerstonejs/dicom-image-loader`.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm v9 or later

### Install

```bash
cd dicom-viewer
npm install
```

### Run in development

```bash
npm run dev
```

Starts Electron with hot reload via electron-vite.

### Build

```bash
npm run build
```

Compiles TypeScript and bundles all three targets (main / preload / renderer).

### Package distributable

```bash
npm run package
```

Produces a platform installer in `dist/`:

| Platform | Output |
|---|---|
| Windows | NSIS installer (x64) |
| macOS | DMG |
| Linux | AppImage |

## Usage

### Opening files

- **Open Files** — select one or more `.dcm` files via the file dialog
- **Open Folder** — select a directory; all DICOM files inside are loaded as a stack, sorted by Instance Number

### Image tools (toolbar)

| Button | Action | Default binding |
|---|---|---|
| W/L | Window / Level | Left-drag |
| Pan | Pan | Left-drag |
| Zoom | Zoom | Left-drag |
| Rotate | Planar rotate | Left-drag |
| Fit | Reset view and W/L | Click |
| Presets | Apply named W/L preset | Select from dropdown |
| Export | Save current frame as PNG | Click |
| MPR | Toggle Multi-Planar Reconstruction | Click (enabled for multi-slice stacks) |

Always-available bindings regardless of active tool:

| Input | Action |
|---|---|
| Middle-click drag | Pan |
| Right-click drag | Zoom |
| Scroll wheel | Navigate stack frames |

### HU readout

Move the mouse over the viewport to see the Hounsfield Unit (HU) value at the cursor position displayed in the bottom-left corner. Useful reference values: air ≈ −1000, water ≈ 0, soft tissue ≈ 20–80, bone ≈ 400–1000.

### MPR (Multi-Planar Reconstruction)

Click **MPR** to switch to a three-pane view showing axial, sagittal, and coronal reformats of the loaded CT volume. Left-drag the crosshairs in any pane to navigate all three planes simultaneously. Click **MPR** again to return to single-pane stack view.

MPR requires a CT series loaded as a multi-slice stack (via Open Folder) with Image Position Patient metadata (tag 0020,0032). X-ray single images and series without position metadata will show a geometric approximation.

### Cine playback

When a multi-frame file or multi-file stack is loaded, a playback bar appears at the bottom:

- **Play / Pause** button
- **Scrubber** — drag to jump to any frame
- **FPS slider** — 1–60 fps

### Metadata panel

Displays known DICOM tags from the first file in the stack. Use the search box to filter by tag name or value.

### Debug log

Click **Logs** in the toolbar to toggle the debug log panel. Shows image loading events, frame counts, pixel decoding details, and errors.

## Architecture

Electron splits into two OS processes. The boundary is strict: no Node/Electron APIs in renderer code, no Cornerstone in main.

```
src/
├── main/           # Node.js / Electron process
│   ├── main.ts         # BrowserWindow, native menu, app lifecycle
│   ├── fileHandler.ts  # dialog.showOpenDialog + fs.readFile → ArrayBuffer
│   └── ipc.ts          # ipcMain.handle registrations
├── preload/        # Isolated context bridge
│   └── preload.ts      # contextBridge.exposeInMainWorld('api', ...)
├── shared/         # Types shared across the process boundary
│   ├── ipcChannels.ts  # IPC channel name constants
│   └── types.ts        # DicomFileData interface
└── renderer/       # Chromium / React process
    ├── App.tsx
    ├── store/
    │   └── index.ts    # Zustand state: imageIds, currentFrame, metadata, playback
    ├── components/
    │   ├── Toolbar.tsx
    │   ├── Viewport.tsx    # Cornerstone3D RenderingEngine owner
    │   ├── CinePlayer.tsx
    │   ├── MetadataPanel.tsx
    │   └── LogPanel.tsx
    └── cornerstone/
        ├── init.ts             # CS3D + tools init, called once before React mounts
        ├── localImageLoader.ts # Custom 'dicomlocal:' scheme image loader (uncompressed)
        ├── compressedLoader.ts # Blob URL wrapper for compressed DICOM via dicom-image-loader
        ├── mprSetup.ts         # MPR volume loading, orthographic viewports, crosshairs
        ├── tools.ts            # Tool group registration and active-tool switching
        └── viewportRef.ts      # Shared DOM ref + viewport helpers (reset, presets, export)
```

### DICOM file flow

1. User clicks Open → `window.api.openFiles()` → IPC → main reads files → returns `DicomFileData[]` (ArrayBuffers via structured clone)
2. Store `loadFiles()` / `loadFolder()`: sorts by Instance Number, calls `storeBuffer()` per file → returns `dicomlocal:<n>` imageIds, extracts metadata tags
3. `Viewport` effect: `viewport.setStack(imageIds, 0)` → Cornerstone3D calls the local loader → `dicom-parser` extracts pixel data → modality LUT applied to Float32 HU values → viewport renders

### Custom image loader

`localImageLoader.ts` decodes uncompressed DICOM pixel data with `dicom-parser` directly and pre-scales pixel values to Hounsfield units (Float32). Compressed transfer syntaxes (JPEG, JPEG-LS, JPEG 2000) are detected in `storeBuffer()` by reading tag `(0002,0010)` and delegated to `@cornerstonejs/dicom-image-loader` via `wadouri:` blob URLs.

## Development

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit (both renderer and node tsconfigs)
```

## Tech Stack

| Library | Role |
|---|---|
| Electron 31 | Desktop shell, file system access |
| React 18 | UI |
| TypeScript 5 | Type safety across all targets |
| electron-vite | Build: main (CJS) + preload (CJS) + renderer (ESM) in one config |
| Cornerstone3D core | Rendering engine, IStackViewport, image cache |
| Cornerstone3D tools | WindowLevelTool, PanTool, ZoomTool, PlanarRotateTool, StackScrollTool |
| dicom-parser | Raw DICOM byte parsing, pixel extraction, metadata |
| Zustand | Renderer app state |
| electron-builder | Distributable packaging |

## License

MIT
