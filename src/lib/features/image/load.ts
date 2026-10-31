import type { ImageDynamicRange, ImageMetadata } from '@/lib/domain'

export const IMAGE_ACCEPT = 'image/*,image/heic,image/heif,.heic,.heif,.avif,.jxl'

const WIDE_EXT = /\.(heic|heif|avif|jxl)$/i
const HEIC_EXT = /\.(heic|heif)$/i

export interface LoadedImage {
  meta: ImageMetadata
  bitmap: ImageBitmap
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  return WIDE_EXT.test(file.name)
}

export function isHeicFile(file: File): boolean {
  const type = file.type.toLowerCase()
  if (type === 'image/heic' || type === 'image/heif' || type === 'image/heic-sequence') return true
  return HEIC_EXT.test(file.name)
}

export async function loadImageFile(file: File): Promise<LoadedImage> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { colorSpaceConversion: 'none' })
  } catch (error) {
    if (isHeicFile(file)) {
      throw new Error("This browser can't decode HEIC. Try Safari or Chrome on macOS.")
    }
    const detail = error instanceof Error ? error.message : ''
    throw new Error(detail ? `Couldn't decode this image. ${detail}` : "Couldn't decode this image.")
  }
  return {
    meta: {
      name: file.name,
      mimeType: file.type || mimeFromName(file.name),
      width: bitmap.width,
      height: bitmap.height,
      byteLength: file.size,
      colorSpace: 'display-p3',
      dynamicRange: 'sdr',
    },
    bitmap,
  }
}

export function withDynamicRange(meta: ImageMetadata, dynamicRange: ImageDynamicRange): ImageMetadata {
  if (meta.dynamicRange === dynamicRange) return meta
  return { ...meta, dynamicRange }
}

function mimeFromName(name: string): string {
  if (/\.heic$/i.test(name)) return 'image/heic'
  if (/\.heif$/i.test(name)) return 'image/heif'
  if (/\.avif$/i.test(name)) return 'image/avif'
  if (/\.jxl$/i.test(name)) return 'image/jxl'
  return 'application/octet-stream'
}
