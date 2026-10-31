import type { Lab } from '@/lib/color'
import shaderSource from './quantize.wgsl?raw'

const TOTAL_SIZE = 35937
const MAX_COLORS = 128
const MAX_POINTS = 32768
const SAMPLE_STRIDE = 4
const HISTOGRAM_TILE = 8
const HISTOGRAM_WG = 256
const WSMEANS_ITERS = 10

const align16 = (n: number) => (n + 15) & ~15

export const HISTOGRAM_BYTES = align16(6 * TOTAL_SIZE * 4)
export const POINTS_BYTES = align16(16 + MAX_POINTS * 16 + MAX_POINTS * 4)
export const CLUSTERS_BYTES = align16(16 + MAX_COLORS * 16 * 2 + MAX_COLORS * MAX_COLORS * 4 * 2)
export const PALETTE_READBACK_BYTES = 16 + MAX_COLORS * 16 * 2

const COMPUTE_ENTRIES = [
  'clear',
  'accumulate',
  'compact',
  'moments',
  'wu',
  'wsmeans_init',
  'wsmeans_distances',
  'wsmeans_assign',
  'wsmeans_update',
  'wsmeans_finalize',
] as const

export interface GpuCluster {
  lab: Lab
  linearRgb: { r: number; g: number; b: number }
}

export class GpuCelebiQuantizer {
  private device: GPUDevice | null = null
  private layout: GPUBindGroupLayout | null = null
  private pipelines = new Map<string, GPUComputePipeline>()
  private settingsBuffer: GPUBuffer | null = null
  private histogram: GPUBuffer | null = null
  private points: GPUBuffer | null = null
  clusters: GPUBuffer | null = null
  private staging: GPUBuffer | null = null
  private maxColors = 16
  private mapped = false

  init(device: GPUDevice): void {
    this.dispose()
    this.device = device
    const module = device.createShaderModule({ code: shaderSource })
    this.layout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    })
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [this.layout] })
    for (const entry of COMPUTE_ENTRIES) {
      this.pipelines.set(
        entry,
        device.createComputePipeline({
          layout: pipelineLayout,
          compute: { module, entryPoint: entry },
        }),
      )
    }
    const storage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    this.settingsBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
    this.histogram = device.createBuffer({ size: HISTOGRAM_BYTES, usage: storage })
    this.points = device.createBuffer({ size: POINTS_BYTES, usage: storage })
    this.clusters = device.createBuffer({ size: CLUSTERS_BYTES, usage: storage })
    this.staging = device.createBuffer({
      size: PALETTE_READBACK_BYTES,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    })
  }

  setMaxColors(maxColors: number): void {
    this.maxColors = Math.min(128, Math.max(2, Math.round(maxColors)))
  }

  dispatch(encoder: GPUCommandEncoder, sourceView: GPUTextureView, width: number, height: number): boolean {
    if (
      !this.device ||
      !this.layout ||
      !this.settingsBuffer ||
      !this.histogram ||
      !this.points ||
      !this.clusters
    ) {
      return false
    }
    const settings = new ArrayBuffer(16)
    const view = new DataView(settings)
    view.setUint32(0, this.maxColors, true)
    view.setFloat32(4, 0, true)
    view.setUint32(8, 1, true)
    view.setUint32(12, 1, true)
    this.device.queue.writeBuffer(this.settingsBuffer, 0, settings)

    const bindGroup = this.device.createBindGroup({
      layout: this.layout,
      entries: [
        { binding: 0, resource: sourceView },
        { binding: 1, resource: { buffer: this.settingsBuffer } },
        { binding: 2, resource: { buffer: this.histogram } },
        { binding: 3, resource: { buffer: this.points } },
        { binding: 4, resource: { buffer: this.clusters } },
      ],
    })

    const clearGroups = Math.ceil(TOTAL_SIZE / HISTOGRAM_WG)
    const histX = Math.max(1, Math.ceil(width / (SAMPLE_STRIDE * HISTOGRAM_TILE)))
    const histY = Math.max(1, Math.ceil(height / (SAMPLE_STRIDE * HISTOGRAM_TILE)))

    const pass = encoder.beginComputePass()
    pass.setBindGroup(0, bindGroup)
    this.run(pass, 'clear', clearGroups)
    this.run(pass, 'accumulate', histX, histY)
    this.run(pass, 'compact', clearGroups)
    this.run(pass, 'moments', 1)
    this.run(pass, 'wu', 1)
    this.run(pass, 'wsmeans_init', clearGroups)
    for (let i = 0; i < WSMEANS_ITERS; i++) {
      this.run(pass, 'wsmeans_distances', 1)
      this.run(pass, 'wsmeans_assign', clearGroups)
      this.run(pass, 'wsmeans_update', 1)
    }
    this.run(pass, 'wsmeans_finalize', 1)
    pass.end()

    if (!this.staging || this.mapped) return false
    encoder.copyBufferToBuffer(this.clusters, 0, this.staging, 0, PALETTE_READBACK_BYTES)
    return true
  }

  async readClusters(): Promise<GpuCluster[] | null> {
    if (!this.device || !this.staging || this.mapped) return null
    this.mapped = true
    try {
      await this.staging.mapAsync(GPUMapMode.READ)
      const bytes = this.staging.getMappedRange().slice(0)
      this.staging.unmap()
      const u32 = new Uint32Array(bytes)
      const f32 = new Float32Array(bytes)
      const count = Math.min(MAX_COLORS, u32[0] ?? 0)
      const clusters: GpuCluster[] = []
      for (let i = 0; i < count; i++) {
        const rgb = 4 + i * 4
        const lab = 4 + MAX_COLORS * 4 + i * 4
        clusters.push({
          linearRgb: { r: f32[rgb]!, g: f32[rgb + 1]!, b: f32[rgb + 2]! },
          lab: { l: f32[lab]!, a: f32[lab + 1]!, b: f32[lab + 2]! },
        })
      }
      return clusters
    } catch {
      try {
        this.staging.unmap()
      } catch {
        /* already unmapped */
      }
      return null
    } finally {
      this.mapped = false
    }
  }

  dispose(): void {
    this.settingsBuffer?.destroy()
    this.histogram?.destroy()
    this.points?.destroy()
    this.clusters?.destroy()
    this.staging?.destroy()
    this.settingsBuffer = null
    this.histogram = null
    this.points = null
    this.clusters = null
    this.staging = null
    this.mapped = false
    this.pipelines.clear()
    this.device = null
  }

  private run(pass: GPUComputePassEncoder, name: string, x: number, y = 1): void {
    const pipeline = this.pipelines.get(name)
    if (!pipeline) return
    pass.setPipeline(pipeline)
    pass.dispatchWorkgroups(x, y, 1)
  }
}
