const blobUrls: string[] = []

/** Wrap an ArrayBuffer in a Blob URL and return a wadouri imageId for it. */
export function createWadouriImageId(buffer: ArrayBuffer): string {
  const blob = new Blob([buffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  blobUrls.push(url)
  return `wadouri:${url}`
}

/** Revoke all blob URLs created for compressed files (call on cache clear). */
export function revokeCompressedBlobs(): void {
  for (const url of blobUrls) URL.revokeObjectURL(url)
  blobUrls.length = 0
}
