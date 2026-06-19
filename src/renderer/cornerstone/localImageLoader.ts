/**
 * Custom Cornerstone3D image loader using dicom-parser directly.
 * Handles uncompressed transfer syntaxes (Explicit/Implicit VR Little Endian,
 * the large majority of clinical DICOM files).
 *
 * To support compressed DICOM (JPEG, JPEG 2000, JPEG-LS), replace this with
 * @cornerstonejs/dicom-image-loader once the Vite/IIFE codec bundling conflict
 * is resolved upstream, or when switching to a webpack-based renderer build.
 */

import { imageLoader, Enums } from '@cornerstonejs/core'
import type { IImage } from '@cornerstonejs/core/types'
import dicomParser from 'dicom-parser'
import { appLog } from '../logger'

export const SCHEME = 'dicomlocal'

const bufferCache = new Map<string, ArrayBuffer>()
let idCounter = 0

export function storeBuffer(buffer: ArrayBuffer): string {
  const imageId = `${SCHEME}:${++idCounter}`
  bufferCache.set(imageId, buffer)
  return imageId
}

export function clearCache(): void {
  bufferCache.clear()
  idCounter = 0
}

export function registerLocalImageLoader(): void {
  imageLoader.registerImageLoader(SCHEME, (imageId) => ({
    promise: buildImage(imageId),
    cancelFn: undefined,
    decache: () => bufferCache.delete(imageId),
  }))
}

async function buildImage(imageId: string): Promise<IImage> {
  const buffer = bufferCache.get(imageId)
  if (!buffer) throw new Error(`No buffer cached for ${imageId}`)

  const byteArray = new Uint8Array(buffer)
  const dataset = dicomParser.parseDicom(byteArray)

  const rows = dataset.uint16('x00280010') ?? 0
  const cols = dataset.uint16('x00280011') ?? 0
  const bitsAllocated = dataset.uint16('x00280100') ?? 8
  const bitsStored = dataset.uint16('x00280101') ?? bitsAllocated
  const pixelRepresentation = dataset.uint16('x00280103') ?? 0
  const samplesPerPixel = dataset.uint16('x00280002') ?? 1
  const photometric = dataset.string('x00280004') ?? 'MONOCHROME2'
  const isColor = samplesPerPixel === 3 || photometric === 'RGB'
  const isSigned = pixelRepresentation === 1

  const slope = parseFloat(dataset.string('x00281053') ?? '1') || 1
  const intercept = parseFloat(dataset.string('x00281052') ?? '0')

  const spacingRaw = dataset.string('x00280030') ?? '1\\1'
  const [rowSpacing, colSpacing] = spacingRaw.split('\\').map((s) => parseFloat(s) || 1)

  const el = dataset.elements['x7fe00010']
  if (!el) {
    appLog('error', `No Pixel Data element in ${imageId}`)
    throw new Error('DICOM file has no Pixel Data element')
  }

  // Copy pixel data to guarantee alignment for typed array views
  const rawBytes = byteArray.slice(el.dataOffset, el.dataOffset + el.length)

  type PixelType = Uint8Array | Uint16Array | Int16Array
  type DataTypeString = 'Uint8Array' | 'Uint16Array' | 'Int16Array'

  let pixelData: PixelType
  let dataType: DataTypeString
  if (bitsAllocated === 8) {
    pixelData = rawBytes
    dataType = 'Uint8Array'
  } else if (bitsAllocated === 16) {
    if (isSigned) {
      pixelData = new Int16Array(rawBytes.buffer)
      dataType = 'Int16Array'
    } else {
      pixelData = new Uint16Array(rawBytes.buffer)
      dataType = 'Uint16Array'
    }
  } else {
    appLog('error', `Unsupported Bits Allocated: ${bitsAllocated} in ${imageId}`)
    throw new Error(`Unsupported Bits Allocated: ${bitsAllocated}`)
  }

  // Derive W/L from DICOM tags; fall back to pixel min/max scan to avoid all-black image
  let windowCenter: number
  let windowWidth: number
  const wcStr = dataset.string('x00281050')
  const wwStr = dataset.string('x00281051')

  if (wcStr && wwStr) {
    windowCenter = parseFloat(wcStr.split('\\')[0])
    windowWidth = parseFloat(wwStr.split('\\')[0])
  } else {
    let lo = Infinity, hi = -Infinity
    for (let i = 0; i < pixelData.length; i++) {
      const v = pixelData[i] as number
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    const loHU = lo * slope + intercept
    const hiHU = hi * slope + intercept
    windowWidth = Math.max(hiHU - loHU, 1)
    windowCenter = loHU + windowWidth / 2
  }

  const maxStorable = isSigned ? (1 << (bitsStored - 1)) - 1 : (1 << bitsStored) - 1
  const minStorable = isSigned ? -(1 << (bitsStored - 1)) : 0

  appLog('debug', `Image ready: ${cols}×${rows} ${bitsAllocated}bit WC=${windowCenter} WW=${windowWidth}`)

  return {
    imageId,
    minPixelValue: minStorable,
    maxPixelValue: maxStorable,
    slope,
    intercept,
    windowCenter,
    windowWidth,
    voiLUTFunction: Enums.VOILUTFunctionType.LINEAR,
    getPixelData: () => pixelData,
    getCanvas: () => renderToCanvas(pixelData, rows, cols, slope, intercept, windowCenter, windowWidth),
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
    sizeInBytes: el.length,
    photometricInterpretation: photometric,
    dataType,
  } satisfies IImage
}

/** CPU-fallback canvas renderer (LINEAR VOI LUT). */
function renderToCanvas(
  pixelData: Uint8Array | Uint16Array | Int16Array,
  rows: number,
  cols: number,
  slope: number,
  intercept: number,
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
    const hu = (pixelData[i] as number) * slope + intercept
    const t = Math.min(1, Math.max(0, (hu - windowCenter + halfWW) / windowWidth))
    const byte = Math.round(t * 255)
    imgData.data[i * 4] = byte
    imgData.data[i * 4 + 1] = byte
    imgData.data[i * 4 + 2] = byte
    imgData.data[i * 4 + 3] = 255
  }

  ctx.putImageData(imgData, 0, 0)
  return canvas
}
