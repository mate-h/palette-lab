import { packArgb, unpackArgb } from './pack'
import type {
  WorkerProgress,
  WorkerRequest,
  WorkerRequestBody,
  WorkerResponse,
  WorkerSolveRequest,
  WorkerSolveResult,
} from './protocol'
import { colorCss } from './format'
import type { ColorSample } from './types'

type Pending = {
  resolve: (value: WorkerResponse) => void
  reject: (error: Error) => void
}

class ColorEngine {
  private worker: Worker | null = null
  private nextId = 1
  private pending = new Map<number, Pending>()
  private readyPromise: Promise<void> | null = null
  spaces: string[] = []
  status: 'idle' | 'loading' | 'ready' | 'error' = 'idle'
  message = 'Color engine idle'
  error: string | null = null

  init(): Promise<void> {
    if (this.readyPromise) return this.readyPromise
    this.status = 'loading'
    this.message = 'Starting color engine…'
    this.readyPromise = this.boot().catch((error: unknown) => {
      this.status = 'error'
      this.error = error instanceof Error ? error.message : 'Failed to start ColorAide'
      this.message = this.error
      this.readyPromise = null
      throw error
    })
    return this.readyPromise
  }

  async colorFromHex(hex: string): Promise<ColorSample> {
    const [sample] = await this.colorFromHexBatch([hex])
    if (!sample) throw new Error(`ColorAide returned no sample for ${hex}`)
    return sample
  }

  async colorFromHexBatch(hexes: string[]): Promise<ColorSample[]> {
    await this.init()
    const response = await this.request({ op: 'fromHex', hexes })
    if (!response.ok || response.op !== 'fromHex') {
      throw new Error(response.ok ? 'Unexpected ColorAide response' : response.error)
    }
    return response.samples.map((sample) => attachArgb(sample))
  }

  async colorFromLab(lab: { l: number; a: number; b: number }): Promise<ColorSample> {
    const [sample] = await this.colorFromLabBatch([lab])
    if (!sample) throw new Error('ColorAide returned no sample for Lab')
    return sample
  }

  async colorFromLabBatch(labs: { l: number; a: number; b: number }[]): Promise<ColorSample[]> {
    await this.init()
    const response = await this.request({ op: 'fromLab', labs })
    if (!response.ok || response.op !== 'fromLab') {
      throw new Error(response.ok ? 'Unexpected ColorAide response' : response.error)
    }
    return response.samples.map((sample) => attachArgb(sample))
  }

  async colorFromArgb(argb: number): Promise<ColorSample> {
    const [sample] = await this.colorFromArgbBatch([argb])
    if (!sample) throw new Error('ColorAide returned no sample')
    return sample
  }

  async colorFromArgbBatch(argbs: number[]): Promise<ColorSample[]> {
    await this.init()
    const response = await this.request({ op: 'fromArgb', argbs })
    if (!response.ok || response.op !== 'fromArgb') {
      throw new Error(response.ok ? 'Unexpected ColorAide response' : response.error)
    }
    return response.samples.map((sample, index) => attachArgb(sample, argbs[index]))
  }

  async colorFromSrgb8(r: number, g: number, b: number): Promise<ColorSample> {
    return this.colorFromArgb(packArgb(r, g, b))
  }

  async deltaE(a: ColorSample | string, b: ColorSample | string, method = '2000'): Promise<number> {
    await this.init()
    const response = await this.request({
      op: 'deltaE',
      a: typeof a === 'string' ? a : a.hex,
      b: typeof b === 'string' ? b : b.hex,
      method,
    })
    if (!response.ok || response.op !== 'deltaE') {
      throw new Error(response.ok ? 'Unexpected ColorAide response' : response.error)
    }
    return response.value
  }

  async deltaE76(a: ColorSample, b: ColorSample): Promise<number> {
    return this.deltaE(a, b, '76')
  }

  async deltaE2000(a: ColorSample, b: ColorSample): Promise<number> {
    return this.deltaE(a, b, '2000')
  }

  async solveRecipe(request: WorkerSolveRequest): Promise<WorkerSolveResult> {
    await this.init()
    const response = await this.request({ op: 'solve', request })
    if (!response.ok || response.op !== 'solve') {
      throw new Error(response.ok ? 'Unexpected ColorAide response' : response.error)
    }
    return response.result
  }

  async convert(hex: string, space: string): Promise<number[]> {
    await this.init()
    const response = await this.request({ op: 'convert', hex, space })
    if (!response.ok || response.op !== 'convert') {
      throw new Error(response.ok ? 'Unexpected ColorAide response' : response.error)
    }
    return response.coords
  }

  private async boot(): Promise<void> {
    this.worker = new Worker(new URL('./coloraide.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<WorkerResponse | WorkerProgress>) => {
      const data = event.data
      if (isProgress(data)) {
        this.message = data.message
        return
      }
      const pending = this.pending.get(data.id)
      if (!pending) return
      this.pending.delete(data.id)
      pending.resolve(data)
    }
    this.worker.onerror = (event) => {
      this.status = 'error'
      this.error = event.message || 'ColorAide worker crashed'
      this.message = this.error
    }

    const response = await this.request({ op: 'init' })
    if (!response.ok || response.op !== 'init') {
      throw new Error(response.ok ? 'Unexpected ColorAide init response' : response.error)
    }
    this.spaces = response.spaces
    this.status = 'ready'
    this.message = `ColorAide ready · ${response.spaces.length} spaces`
  }

  private request(request: WorkerRequestBody): Promise<WorkerResponse> {
    if (!this.worker) {
      return Promise.reject(new Error('ColorAide worker is not running'))
    }
    const id = this.nextId++
    const message: WorkerRequest = { ...request, id }
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker?.postMessage(message)
    })
  }
}

function isProgress(data: WorkerResponse | WorkerProgress): data is WorkerProgress {
  return 'type' in data && data.type === 'progress'
}

function attachArgb(sample: Omit<ColorSample, 'argb'>, argb?: number): ColorSample {
  const packed =
    argb ??
    packArgb(
      Math.round(sample.srgb.r * 255),
      Math.round(sample.srgb.g * 255),
      Math.round(sample.srgb.b * 255),
    )
  const { r, g, b } = unpackArgb(packed)
  const next: ColorSample = {
    ...sample,
    argb: packed,
    hex: sample.hex.startsWith('#') ? sample.hex.toLowerCase() : `#${sample.hex.toLowerCase()}`,
    srgb: sample.srgb ?? { r: r / 255, g: g / 255, b: b / 255 },
    displayP3: sample.displayP3 ?? sample.srgb ?? { r: r / 255, g: g / 255, b: b / 255 },
    rec2020: sample.rec2020 ?? sample.srgb ?? { r: r / 255, g: g / 255, b: b / 255 },
    jzazbz: sample.jzazbz ?? { jz: 0, az: 0, bz: 0 },
    relativeLuminance: sample.relativeLuminance ?? sample.xyz?.y ?? 0,
    inSrgbGamut: sample.inSrgbGamut ?? true,
    css: sample.css ?? '',
  }
  return { ...next, css: next.css || colorCss(next) }
}

export const colorEngine = new ColorEngine()

export function initColorEngine(): Promise<void> {
  return colorEngine.init()
}

export function colorFromHex(hex: string): Promise<ColorSample> {
  return colorEngine.colorFromHex(hex)
}

export function colorFromLab(lab: { l: number; a: number; b: number }): Promise<ColorSample> {
  return colorEngine.colorFromLab(lab)
}

export function colorFromLabBatch(labs: { l: number; a: number; b: number }[]): Promise<ColorSample[]> {
  return colorEngine.colorFromLabBatch(labs)
}

export function colorFromArgb(argb: number): Promise<ColorSample> {
  return colorEngine.colorFromArgb(argb)
}

export function colorFromArgbBatch(argbs: number[]): Promise<ColorSample[]> {
  return colorEngine.colorFromArgbBatch(argbs)
}

export function colorFromSrgb8(r: number, g: number, b: number): Promise<ColorSample> {
  return colorEngine.colorFromSrgb8(r, g, b)
}

export function deltaE76(a: ColorSample, b: ColorSample): Promise<number> {
  return colorEngine.deltaE76(a, b)
}

export function deltaE2000(a: ColorSample, b: ColorSample): Promise<number> {
  return colorEngine.deltaE2000(a, b)
}

export function solveRecipe(request: WorkerSolveRequest): Promise<WorkerSolveResult> {
  return colorEngine.solveRecipe(request)
}
