/**
 * Custom Cornerstone3D image loader using dicom-parser directly.
 * Handles uncompressed transfer syntaxes (Explicit/Implicit VR Little Endian,
 * the large majority of clinical DICOM files) including multi-frame DICOM.
 *
 * To support compressed DICOM (JPEG, JPEG 2000, JPEG-LS), replace this with
 * @cornerstonejs/dicom-image-loader once the Vite/IIFE codec bundling conflict
 * is resolved upstream, or when switching to a webpack-based renderer build.
 */

import { imageLoader, metaData, utilities, Enums, cache } from '@cornerstonejs/core'
import type { IImage } from '@cornerstonejs/core/types'
import dicomParser from 'dicom-parser'
import { appLog } from '../logger'

export const SCHEME = 'dicomlocal'

const bufferCache = new Map<string, ArrayBuffer>()
const allImageIds = new Set<string>()

// Parse 'dicomlocal:<id>' or 'dicomlocal:<id>:<frameIndex>' imageIds.
function parseImageId(imageId: string): { baseKey: string; frameIndex: number } {
  const parts = imageId.split(':')
  if (parts.length === 3) {
    return { baseKey: `${parts[0]}:${parts[1]}`, frameIndex: parseInt(parts[2], 10) }
  }
  return { baseKey: imageId, frameIndex: 0 }
}

interface DicomMeta {
  imagePixelModule: {
    pixelRepresentation: number
    bitsAllocated: number
    bitsStored: number
    highBit: number
    photometricInterpretation: string
    samplesPerPixel: number
  }
  generalSeriesModule: { modality: string }
  imagePlaneModule: {
    rowPixelSpacing: number
    columnPixelSpacing: number
    rowCosines: [number, number, number]
    columnCosines: [number, number, number]
    imagePositionPatient: [number, number, number]
    imageOrientationPatient: number[]
    usingDefaultValues: boolean
  }
  scalingModule: { rescaleSlope: number; rescaleIntercept: number }
}
const metaCache = new Map<string, DicomMeta>()
let idCounter = 0

function localMetadataProvider(type: string, imageId: string): unknown {
  if (!imageId.startsWith(SCHEME + ':')) return undefined
  const { baseKey } = parseImageId(imageId)
  const m = metaCache.get(baseKey)
  if (!m) return undefined
  return (m as unknown as Record<string, unknown>)[type]
}

export function registerLocalImageLoader(): void {
  metaData.addProvider(localMetadataProvider, 9999)

  imageLoader.registerImageLoader(SCHEME, (imageId) => ({
    promise: buildImage(imageId),
    cancelFn: undefined,
    decache: () => {
      allImageIds.delete(imageId)
    },
  }))
}

/** Store a buffer and return one imageId per frame (≥1). */
export function storeBuffer(buffer: ArrayBuffer): string[] {
  const baseId = `${SCHEME}:${++idCounter}`
  bufferCache.set(baseId, buffer)

  try {
    const dataset = dicomParser.parseDicom(new Uint8Array(buffer))
    const numFrames = Math.max(1, parseInt(dataset.string('x00280008') ?? '1', 10) || 1)
    if (numFrames > 1) {
      appLog('info', `Multi-frame DICOM detected: ${numFrames} frames`)
      const ids = Array.from({ length: numFrames }, (_, i) => `${baseId}:${i}`)
      ids.forEach((id) => allImageIds.add(id))
      return ids
    }
  } catch {
    // fall through — treat as single frame
  }

  allImageIds.add(baseId)
  return [baseId]
}

export function clearCache(): void {
  // Evict all known imageIds from CS3D's image cache before clearing our maps.
  // idCounter is intentionally NOT reset — IDs must stay unique across loads so
  // CS3D doesn't serve a stale cached image under a reused ID.
  for (const imageId of allImageIds) {
    try {
      if (cache.getImageLoadObject(imageId)) cache.removeImageLoadObject(imageId)
    } catch {
      // ignore
    }
  }
  allImageIds.clear()
  bufferCache.clear()
  metaCache.clear()
}

async function buildImage(imageId: string): Promise<IImage> {
  const { baseKey, frameIndex } = parseImageId(imageId)
  const buffer = bufferCache.get(baseKey)
  if (!buffer) throw new Error(`No buffer cached for ${imageId}`)

  const byteArray = new Uint8Array(buffer)
  const dataset = dicomParser.parseDicom(byteArray)

  const rows = dataset.uint16('x00280010') ?? 0
  const cols = dataset.uint16('x00280011') ?? 0
  const bitsAllocated = dataset.uint16('x00280100') ?? 8
  const bitsStored = dataset.uint16('x00280101') ?? bitsAllocated
  const highBit = dataset.uint16('x00280102') ?? bitsStored - 1
  const pixelRepresentation = dataset.uint16('x00280103') ?? 0
  const samplesPerPixel = dataset.uint16('x00280002') ?? 1
  const photometric = dataset.string('x00280004')?.trim() ?? 'MONOCHROME2'
  const modality = dataset.string('x00080060')?.trim() ?? 'OT'
  const isColor = samplesPerPixel === 3 || photometric === 'RGB'
  const isSigned = pixelRepresentation === 1

  const slope = parseFloat(dataset.string('x00281053') ?? '1') || 1
  const intercept = parseFloat(dataset.string('x00281052') ?? '0')

  const spacingRaw = dataset.string('x00280030') ?? '1\\1'
  const [rowSpacing, colSpacing] = spacingRaw.split('\\').map((s) => parseFloat(s) || 1)

  const ippRaw = dataset.string('x00200032')
  const imagePositionPatient: [number, number, number] = ippRaw
    ? (ippRaw.split('\\').map(Number) as [number, number, number])
    : [0, 0, 0]

  const iopRaw = dataset.string('x00200037')
  const imageOrientationPatient = iopRaw ? iopRaw.split('\\').map(Number) : [1, 0, 0, 0, 1, 0]
  const rowCosines = imageOrientationPatient.slice(0, 3) as [number, number, number]
  const columnCosines = imageOrientationPatient.slice(3, 6) as [number, number, number]

  const el = dataset.elements['x7fe00010']
  if (!el) {
    appLog('error', `No Pixel Data element in ${imageId}`)
    throw new Error('DICOM file has no Pixel Data element')
  }

  // For multi-frame: extract just this frame's bytes from the flat pixel data block.
  const frameSizeBytes = rows * cols * (bitsAllocated / 8) * samplesPerPixel
  const frameByteOffset = frameIndex * frameSizeBytes
  const rawBytes = byteArray.slice(
    el.dataOffset + frameByteOffset,
    el.dataOffset + frameByteOffset + frameSizeBytes,
  )

  type RawPixelType = Uint8Array | Uint16Array | Int16Array
  let rawPixels: RawPixelType
  if (bitsAllocated === 8) {
    rawPixels = rawBytes
  } else if (bitsAllocated === 16) {
    rawPixels = isSigned
      ? new Int16Array(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength / 2)
      : new Uint16Array(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength / 2)
  } else {
    appLog('error', `Unsupported Bits Allocated: ${bitsAllocated} in ${imageId}`)
    throw new Error(`Unsupported Bits Allocated: ${bitsAllocated}`)
  }

  // CS3D v5 puts pixel data directly into the VTK scalar array and then sets the VTK
  // transfer function range from windowCenter/windowWidth. Those W/L values are in
  // Hounsfield-unit (post-rescale) space, but the VTK scalars must also be in that
  // same space — otherwise there is a mismatch and everything renders white.
  // Solution: pre-apply the modality LUT (slope/intercept) to produce Float32 HU values,
  // mark the image as pre-scaled, and keep W/L in HU space. This matches what
  // @cornerstonejs/dicom-image-loader does internally.
  const numPixels = rawPixels.length
  const scaledPixels = new Float32Array(numPixels)
  let minVal = Infinity,
    maxVal = -Infinity
  for (let i = 0; i < numPixels; i++) {
    const hu = (rawPixels[i] as number) * slope + intercept
    scaledPixels[i] = hu
    if (hu < minVal) minVal = hu
    if (hu > maxVal) maxVal = hu
  }

  let windowCenter: number
  let windowWidth: number
  const wcStr = dataset.string('x00281050')
  const wwStr = dataset.string('x00281051')

  if (wcStr && wwStr) {
    windowCenter = parseFloat(wcStr.split('\\')[0])
    windowWidth = parseFloat(wwStr.split('\\')[0])
  } else {
    windowWidth = Math.max(maxVal - minVal, 1)
    windowCenter = minVal + windowWidth / 2
  }

  // Register metadata keyed by baseKey so all frames of a multi-frame file share it.
  if (!metaCache.has(baseKey)) {
    metaCache.set(baseKey, {
      imagePixelModule: {
        pixelRepresentation,
        bitsAllocated,
        bitsStored,
        highBit,
        photometricInterpretation: photometric,
        samplesPerPixel,
      },
      generalSeriesModule: { modality },
      imagePlaneModule: {
        rowPixelSpacing: rowSpacing,
        columnPixelSpacing: colSpacing,
        rowCosines,
        columnCosines,
        imagePositionPatient,
        imageOrientationPatient,
        usingDefaultValues: !ippRaw,
      },
      scalingModule: { rescaleSlope: slope, rescaleIntercept: intercept },
    })
  }

  const voxelManager = utilities.VoxelManager.createImageVoxelManager({
    scalarData: scaledPixels,
    width: cols,
    height: rows,
    numberOfComponents: samplesPerPixel,
  })

  appLog(
    'debug',
    `Image built: ${cols}×${rows} ${bitsAllocated}bit ${modality} frame=${frameIndex} WC=${windowCenter} WW=${windowWidth}`,
  )

  return {
    imageId,
    minPixelValue: minVal,
    maxPixelValue: maxVal,
    slope: 1,
    intercept: 0,
    windowCenter,
    windowWidth,
    voiLUTFunction: Enums.VOILUTFunctionType.LINEAR,
    getPixelData: () => scaledPixels,
    getCanvas: () => renderToCanvas(scaledPixels, rows, cols, windowCenter, windowWidth),
    rows,
    columns: cols,
    height: rows,
    width: cols,
    color: isColor,
    rgba: false,
    invert: false,
    numberOfComponents: samplesPerPixel,
    columnPixelSpacing: colSpacing,
    rowPixelSpacing: rowSpacing,
    sizeInBytes: numPixels * 4,
    photometricInterpretation: photometric,
    dataType: 'Float32Array',
    isPreScaled: true,
    preScale: {
      enabled: true,
      scaled: true,
      scalingParameters: { rescaleSlope: slope, rescaleIntercept: intercept },
    },
    voxelManager,
  } satisfies IImage
}

function renderToCanvas(
  scaledPixels: Float32Array,
  rows: number,
  cols: number,
  windowCenter: number,
  windowWidth: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = cols
  canvas.height = rows
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const imgData = ctx.createImageData(cols, rows)
  const halfWW = windowWidth / 2

  for (let i = 0, n = rows * cols; i < n; i++) {
    const t = Math.min(1, Math.max(0, (scaledPixels[i] - windowCenter + halfWW) / windowWidth))
    const byte = Math.round(t * 255)
    imgData.data[i * 4] = byte
    imgData.data[i * 4 + 1] = byte
    imgData.data[i * 4 + 2] = byte
    imgData.data[i * 4 + 3] = 255
  }

  ctx.putImageData(imgData, 0, 0)
  return canvas
}
