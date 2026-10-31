export function packArgb(r: number, g: number, b: number, a = 255): number {
  return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0
}

export function unpackArgb(argb: number): { r: number; g: number; b: number; a: number } {
  return {
    a: (argb >>> 24) & 0xff,
    r: (argb >>> 16) & 0xff,
    g: (argb >>> 8) & 0xff,
    b: argb & 0xff,
  }
}

export function hexFromSrgb8(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}
