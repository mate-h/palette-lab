<script lang="ts">
  import * as d3 from 'd3'
  import { bernsWavelengths } from '@/lib/data/berns'
  import type { BernsArtistPaint } from '@/lib/data/berns'

  let { km }: { km: BernsArtistPaint } = $props()

  const wavelengths = bernsWavelengths()
  const points = $derived(
    wavelengths.map((wavelength, i) => ({
      wavelength,
      k: km.k[i] ?? 0,
      s: km.s[i] ?? 0,
    })),
  )

  let host = $state<HTMLDivElement>()
  let hover = $state<{ wavelength: number; k: number; s: number } | null>(null)

  $effect(() => {
    const el = host
    const series = points
    if (!el) return

    const draw = (): void => {
      const width = el.clientWidth
      if (width < 40) return

      const height = 300
      const margin = { top: 16, right: 52, bottom: 56, left: 52 }
      const innerWidth = width - margin.left - margin.right
      const innerHeight = height - margin.top - margin.bottom

      d3.select(el).selectAll('*').remove()

      const svg = d3
        .select(el)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('role', 'img')
        .attr('aria-label', 'Absorption K and scattering S versus wavelength')

      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

      const x = d3
        .scaleLinear()
        .domain(d3.extent(series, (d) => d.wavelength) as [number, number])
        .range([0, innerWidth])

      const yK = d3
        .scaleLinear()
        .domain([0, (d3.max(series, (d) => d.k) ?? 1) * 1.08])
        .nice()
        .range([innerHeight, 0])

      const yS = d3
        .scaleLinear()
        .domain([0, (d3.max(series, (d) => d.s) ?? 1) * 1.08])
        .nice()
        .range([innerHeight, 0])

      g.append('g')
        .attr('class', 'grid')
        .call(
          d3
            .axisLeft(yK)
            .ticks(5)
            .tickSize(-innerWidth)
            .tickFormat(() => ''),
        )
        .call((axis) => {
          axis.select('.domain').remove()
          axis.selectAll('line').attr('stroke', 'var(--rule)').attr('stroke-dasharray', '2 3')
        })

      g.append('g')
        .attr('transform', `translate(0,${innerHeight + 8})`)
        .call(d3.axisBottom(x).ticks(8).tickFormat((d) => String(d)))
        .call((axis) => styleAxis(axis, 'var(--paper-500)'))

      g.append('g')
        .call(d3.axisLeft(yK).ticks(5))
        .call((axis) => styleAxis(axis, 'var(--brass)'))

      g.append('g')
        .attr('transform', `translate(${innerWidth},0)`)
        .call(d3.axisRight(yS).ticks(5))
        .call((axis) => styleAxis(axis, 'var(--paper-300, #c4bbae)'))

      const kLine = d3
        .line<(typeof series)[number]>()
        .x((d) => x(d.wavelength))
        .y((d) => yK(d.k))
        .curve(d3.curveMonotoneX)

      const sLine = d3
        .line<(typeof series)[number]>()
        .x((d) => x(d.wavelength))
        .y((d) => yS(d.s))
        .curve(d3.curveMonotoneX)

      g.append('path')
        .datum(series)
        .attr('fill', 'none')
        .attr('stroke', 'var(--brass)')
        .attr('stroke-width', 1.75)
        .attr('d', kLine)

      g.append('path')
        .datum(series)
        .attr('fill', 'none')
        .attr('stroke', 'var(--paper-300, #c4bbae)')
        .attr('stroke-width', 1.75)
        .attr('d', sLine)

      const defs = svg.append('defs')
      const gradientId = `km-visible-spectrum-${km.id}`
      const gradient = defs.append('linearGradient').attr('id', gradientId)
      for (const nm of d3.range(380, 751, 10)) {
        gradient
          .append('stop')
          .attr('offset', `${((nm - 380) / 370) * 100}%`)
          .attr('stop-color', wavelengthHex(nm))
      }
      g.append('rect')
        .attr('y', innerHeight)
        .attr('width', innerWidth)
        .attr('height', 8)
        .attr('fill', `url(#${gradientId})`)

      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 40)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--paper-500)')
        .attr('font-family', 'IBM Plex Mono, ui-monospace, monospace')
        .attr('font-size', 10)
        .text('λ nm')

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -40)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--brass)')
        .attr('font-family', 'IBM Plex Mono, ui-monospace, monospace')
        .attr('font-size', 10)
        .text('K')

      g.append('text')
        .attr('transform', 'rotate(90)')
        .attr('x', innerHeight / 2)
        .attr('y', -40)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--paper-300, #c4bbae)')
        .attr('font-family', 'IBM Plex Mono, ui-monospace, monospace')
        .attr('font-size', 10)
        .text('S')

      const rule = g
        .append('line')
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', 'var(--paper-100)')
        .attr('stroke-opacity', 0.35)
        .attr('stroke-dasharray', '2 2')
        .style('display', 'none')

      const kDot = g.append('circle').attr('r', 3.5).attr('fill', 'var(--brass)').style('display', 'none')
      const sDot = g
        .append('circle')
        .attr('r', 3.5)
        .attr('fill', 'var(--paper-300, #c4bbae)')
        .style('display', 'none')

      const bisect = d3.bisector<(typeof series)[number], number>((d) => d.wavelength).center

      g.append('rect')
        .attr('width', innerWidth)
        .attr('height', innerHeight)
        .attr('fill', 'transparent')
        .style('cursor', 'crosshair')
        .on('pointerenter', () => {
          rule.style('display', null)
          kDot.style('display', null)
          sDot.style('display', null)
        })
        .on('pointerleave', () => {
          rule.style('display', 'none')
          kDot.style('display', 'none')
          sDot.style('display', 'none')
          hover = null
        })
        .on('pointermove', (event: PointerEvent) => {
          const [px] = d3.pointer(event)
          const wavelength = x.invert(px)
          const nearest = series[bisect(series, wavelength)]
          if (!nearest) return
          rule.attr('x1', x(nearest.wavelength)).attr('x2', x(nearest.wavelength))
          kDot.attr('cx', x(nearest.wavelength)).attr('cy', yK(nearest.k))
          sDot.attr('cx', x(nearest.wavelength)).attr('cy', yS(nearest.s))
          hover = nearest
        })
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(el)
    return () => {
      observer.disconnect()
      d3.select(el).selectAll('*').remove()
    }
  })

  function styleAxis(axis: d3.Selection<SVGGElement, unknown, d3.BaseType, unknown>, color: string): void {
    axis.select('.domain').attr('stroke', 'var(--rule)')
    axis.selectAll('line').attr('stroke', 'var(--rule)')
    axis
      .selectAll('text')
      .attr('fill', color)
      .attr('font-family', 'IBM Plex Mono, ui-monospace, monospace')
      .attr('font-size', 10)
  }

  function formatCoeff(value: number): string {
    if (value === 0) return '0'
    if (value >= 0.001) return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
    return value.toExponential(2)
  }

  function wavelengthHex(nm: number): string {
    let r = 0
    let g = 0
    let b = 0
    if (nm < 380) {
      r = 0.2
    } else if (nm < 440) {
      r = -(nm - 440) / 60
      b = 1
    } else if (nm < 490) {
      g = (nm - 440) / 50
      b = 1
    } else if (nm < 510) {
      g = 1
      b = -(nm - 510) / 20
    } else if (nm < 580) {
      r = (nm - 510) / 70
      g = 1
    } else if (nm < 645) {
      r = 1
      g = -(nm - 645) / 65
    } else if (nm <= 750) {
      r = 1
    }
    let factor = 1
    if (nm < 420) factor = 0.3 + (0.7 * (nm - 380)) / 40
    else if (nm > 700) factor = 0.3 + (0.7 * (750 - nm)) / 50
    const toByte = (channel: number) => Math.round(255 * Math.max(0, Math.min(1, channel * factor)))
    return `rgb(${toByte(r)},${toByte(g)},${toByte(b)})`
  }
</script>

<figure class="border border-rule bg-ink-900">
  <div class="flex flex-wrap items-center justify-between gap-2 px-3 pt-3 font-mono text-10px tracking-wide uppercase">
    <div class="flex gap-4">
      <span class="text-brass">— Absorption K</span>
      <span class="text-paper-300">— Scattering S</span>
    </div>
    <span class="text-paper-500">
      {#if hover}
        {hover.wavelength} nm · K {formatCoeff(hover.k)} · S {formatCoeff(hover.s)}
      {:else}
        Hover a wavelength
      {/if}
    </span>
  </div>
  <div bind:this={host} class="w-full"></div>
</figure>
