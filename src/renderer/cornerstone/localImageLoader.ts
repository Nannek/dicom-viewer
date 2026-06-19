/**
 * Custom Cornerstone3D image loader using dicom-parser directly.
 * Handles uncompressed transfer syntaxes (Explicit/Implicit VR Little Endian,
 * the large majority of clinical DICOM files).
 *
 * To support compressed DICOM (JPEG, JPEG 2000, JPEG-LS), replace this with
 * @cornerstonejs/dicom-image-loader once the Vite/IIFE codec bundling conflict
 * is resolved upstream, or when switching to a webpack-based renderer build.
 */

import { imageLoader } from '@cornerstonejs/core'
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
  const intercept = parseFloat(dataset.string('x00281052') ?? '0') || 0
  const windowCenter = parseFloat(dataset.string('x00281050') ?? '128') || 128
  const windowWidth = parseFloat(dataset.string('x00281051') ?? '256') || 256

  const spacingRaw = dataset.string('x00280030') ?? '1\\1'
  const [rowSpacing, colSpacing] = spacingRaw.split('\\').map((s) => parseFloat(s) || 1)

  appLog('debug', `Building image ${imageId}`, {
    rows,
    cols,
    bitsAllocated,
    bitsStored,
    isSigned,
    isColor,
    photometric,
    slope,
    intercept,
    windowCenter,
    windowWidth,
  })

  const el = dataset.elements['x7fe00010']
  if (!el) {
    appLog('error', `No Pixel Data element in ${imageId}`)
    throw new Error('DICOM file has no Pixel Data element')
  }

  // Copy pixel data to guarantee alignment for typed array views
  const rawBytes = byteArray.slice(el.dataOffset, el.dataOffset + el.length)

  let pixelData: Uint8Array | Uint16Array | Int16Array
  if (bitsAllocated === 8) {
    pixelData = rawBytes
  } else if (bitsAllocated === 16) {
    pixelData = isSigned
      ? new Int16Array(rawBytes.buffer)
      : new Uint16Array(rawBytes.buffer)
  } else {
    appLog('error', `Unsupported Bits Allocated: ${bitsAllocated} in ${imageId}`)
    throw new Error(`Unsupported Bits Allocated: ${bitsAllocated}`)
  }

  const maxVal = isSigned ? (1 << (bitsStored - 1)) - 1 : (1 << bitsStored) - 1
  const minVal = isSigned ? -(1 << (bitsStored - 1)) : 0

  return {
    imageId,
    minPixelValue: minVal,
    maxPixelValue: maxVal,
    slope,
    intercept,
    windowCenter,
    windowWidth,
    getPixelData: () => pixelData,
    rows,
    columns: cols,
    height: rows,
    width: cols,
    color: isColor,
    rgba: false,
    columnPixelSpacing: colSpacing,
    rowPixelSpacing: rowSpacing,
    sizeInBytes: el.length,
    voiLUTFunction: 'LINEAR',
    numberOfComponents: samplesPerPixel,
  } satisfies IImage
}
