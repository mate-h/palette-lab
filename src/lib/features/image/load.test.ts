import { describe, expect, it } from 'vitest'
import { isHeicFile, isImageFile } from './load'

function file(name: string, type: string): File {
  return new File([new Uint8Array([0])], name, { type })
}

describe('isImageFile', () => {
  it('accepts a JPEG with an image MIME type', () => {
    expect(isImageFile(file('plate.jpg', 'image/jpeg'))).toBe(true)
  })

  it('accepts HEIC with an empty MIME type', () => {
    expect(isImageFile(file('IMG_0001.HEIC', ''))).toBe(true)
  })

  it('accepts HEIC with an image/heic MIME type', () => {
    expect(isImageFile(file('photo.heic', 'image/heic'))).toBe(true)
  })

  it('accepts AVIF and JXL by extension', () => {
    expect(isImageFile(file('wide.avif', ''))).toBe(true)
    expect(isImageFile(file('wide.jxl', ''))).toBe(true)
  })

  it('rejects a non-image with an empty MIME type', () => {
    expect(isImageFile(file('notes.txt', ''))).toBe(false)
  })
})

describe('isHeicFile', () => {
  it('matches HEIC/HEIF by type or extension', () => {
    expect(isHeicFile(file('a.heic', ''))).toBe(true)
    expect(isHeicFile(file('a.bin', 'image/heif'))).toBe(true)
    expect(isHeicFile(file('a.jpg', 'image/jpeg'))).toBe(false)
  })
})
