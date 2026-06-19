import { imageLoader, metaData, utilities, Enums } from '@cornerstonejs/core'
import type { IImage } from '@cornerstonejs/core/types'
import dicomParser from 'dicom-parser'
import { appLog } from '../logger'

export const SCHEME = 'dicomlocal'

const bufferCache = new Map<string, ArrayBuffer>()

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
  const m = metaCache.get(imageId)
  if (!m) return undefined
  return (m as Record<string, unknown>)[type]
}

export function registerLocalImageLoader(): void {
  metaData.addProvider(localMetadataProvider, 9999)

  imageLoader.registerImageLoader(SCHEME, (imageId) => ({
    promise: buildImage(imageId),
    cancelFn: undefined,
    decache: () => {
      bufferCache.delete(imageId)
      metaCache.delete(imageId)
    },
  }))
}

export function storeBuffer(buffer: ArrayBuffer): string {
  const imageId = `${SCHEME}:${++idCounter}`
  bufferCache.set(imageId, buffer)
  return imageId
}

export function clearCache(): void {
  bufferCache.clear()
  metaCache.clear()
  idCounter = 0
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
      pixelData = new Int16Array(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength / 2)
      dataType = 'Int16Array'
    } else {
      pixelData = new Uint16Array(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength / 2)
      dataType = 'Uint16Array'
    }
  } else {
    throw new Error(`Unsupported Bits Allocated: ${bitsAllocated}`)
  }

  let windowCenter: number
  let windowWidth: number
  const wcStr = dataset.string('x00281050')
  const wwStr = dataset.string('x00281051')

  if (wcStr && wwStr) {
    windowCenter = parseFloat(wcStr.split('\\')[0])
    windowWidth = parseFloat(wwStr.split('\\')[0])
  } else {
    let lo = Infinity,
      hi = -Infinity
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

  // Register metadata so CS3D's buildMetadata() can look up imagePixelModule,
  // generalSeriesModule, and imagePlaneModule by imageId.
  metaCache.set(imageId, {
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

  // Build voxelManager directly so CS3D's ensureVoxelManager() skips the
  // `delete image.imageFrame.pixelData` line that would throw for custom loaders.
  const voxelManager = utilities.VoxelManager.createImageVoxelManager({
    scalarData: pixelData,
    width: cols,
    height: rows,
    numberOfComponents: samplesPerPixel,
  })

  appLog('debug', `Image built: ${cols}×${rows} ${bitsAllocated}bit ${modality} WC=${windowCenter} WW=${windowWidth}`)

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
    voxelManager,
  } satisfies IImage
}

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
