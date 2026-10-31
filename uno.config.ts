import extractorSvelte from '@unocss/extractor-svelte'
import { defineConfig, presetWind3 } from 'unocss'

const token = (name: string) =>
  `color-mix(in oklab, var(${name}) calc(%alpha * 100%), transparent)`

export default defineConfig({
  extractors: [extractorSvelte()],
  presets: [presetWind3()],
  shortcuts: {
    btn: [
      'appearance-none inline-flex items-center justify-center border border-solid border-transparent bg-transparent',
      'cursor-pointer font-mono uppercase tracking-wide whitespace-nowrap select-none',
      'outline-none transition-colors duration-150',
      'focus-visible:ring-1 focus-visible:ring-brass',
      'disabled:cursor-not-allowed disabled:opacity-40',
    ].join(' '),
    'btn-sm': 'px-2 py-1 text-10px',
    'btn-md': 'px-3 py-1.5 text-11px',
    'btn-lg': 'px-3 py-2 text-11px tracking-[0.16em]',
    'btn-primary':
      'border-brass text-brass hover:bg-brass hover:text-ink-950',
    'btn-secondary':
      'border-ink-500 bg-ink-800 text-paper-100 hover:border-brass hover:bg-ink-700 hover:text-paper-50',
    'btn-ghost': 'text-paper-300 hover:text-brass',
    'btn-group': 'divide-x divide-solid divide-ink-500 border border-solid border-ink-500 bg-ink-900',
    'btn-seg': [
      'appearance-none inline-flex items-center justify-center border-0 border-solid bg-transparent px-3 py-1.5',
      'cursor-pointer font-mono text-11px tracking-[0.14em] uppercase whitespace-nowrap',
      'text-paper-300 outline-none transition-colors duration-150',
      'hover:bg-ink-800 hover:text-paper-50',
      'focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brass',
      'disabled:cursor-not-allowed disabled:opacity-40',
      'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
      'data-[state=active]:bg-ink-600 data-[state=active]:text-paper-50',
      'data-[state=on]:bg-ink-600 data-[state=on]:text-paper-50',
    ].join(' '),
    'slider-track': 'relative h-px w-full bg-ink-500',
    'slider-range': 'absolute h-px bg-brass',
    'slider-thumb': [
      'block size-3 shrink-0 bg-ink-900',
      '[border:1px_solid_var(--brass)]',
      'outline-none focus-visible:ring-1 focus-visible:ring-brass',
    ].join(' '),
    check: [
      'appearance-none size-3 shrink-0 cursor-pointer',
      'border border-solid border-ink-500 bg-ink-900',
      'outline-none focus-visible:ring-1 focus-visible:ring-brass',
      'checked:border-umber checked:bg-umber',
    ].join(' '),
  },
  theme: {
    colors: {
      ink: {
        950: token('--ink-950'),
        900: token('--ink-900'),
        800: token('--ink-800'),
        700: token('--ink-700'),
        600: token('--ink-600'),
        500: token('--ink-500'),
      },
      paper: {
        50: token('--paper-50'),
        100: token('--paper-100'),
        300: token('--paper-300'),
        500: token('--paper-500'),
        700: token('--paper-700'),
      },
      brass: token('--brass'),
      rule: token('--rule'),
      umber: token('--umber'),
    },
    fontFamily: {
      sans: 'IBM Plex Sans, ui-sans-serif, system-ui, sans-serif',
      mono: 'IBM Plex Mono, ui-monospace, SFMono-Regular, monospace',
    },
  },
})
