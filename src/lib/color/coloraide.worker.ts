/// <reference lib="webworker" />

import pipelinePy from './pipeline.py?raw'
import scienceInitPy from '../../../science/__init__.py?raw'
import scienceColorPy from '../../../science/color.py?raw'
import scienceKmPy from '../../../science/km.py?raw'
import sciencePhysicalPy from '../../../science/physical.py?raw'
import scienceMixingPy from '../../../science/mixing.py?raw'
import sciencePaintsPy from '../../../science/paints.py?raw'
import scienceSolvePy from '../../../science/solve.py?raw'
import scienceLoopPy from '../../../science/loop.py?raw'
import bernsJson from '../../../science/data/berns-artist-paint.json?raw'
import { PYODIDE_INDEX, type WorkerProgress, type WorkerRequest, type WorkerResponse } from './protocol'

type Pyodide = {
  loadPackage: (name: string | string[]) => Promise<void>
  runPythonAsync: (code: string) => Promise<unknown>
  FS: {
    mkdirTree: (path: string) => void
    writeFile: (path: string, data: string) => void
  }
  globals: {
    get: (name: string) => { (payload?: string): string; destroy?: () => void }
  }
}

type PyodideModule = {
  loadPyodide: (options: { indexURL: string }) => Promise<Pyodide>
}

let pyodide: Pyodide | null = null

function progress(message: string): void {
  const messageBody: WorkerProgress = { type: 'progress', message }
  self.postMessage(messageBody)
}

function reply(response: WorkerResponse): void {
  self.postMessage(response)
}

function call(name: string, payload?: string): string {
  if (!pyodide) throw new Error('ColorAide pipeline is not initialized')
  const fn = pyodide.globals.get(name)
  try {
    return payload === undefined ? fn() : fn(payload)
  } finally {
    fn.destroy?.()
  }
}

function mountScience(runtime: Pyodide): void {
  runtime.FS.mkdirTree('/home/pyodide/science/data')
  runtime.FS.writeFile('/home/pyodide/science/__init__.py', scienceInitPy)
  runtime.FS.writeFile('/home/pyodide/science/color.py', scienceColorPy)
  runtime.FS.writeFile('/home/pyodide/science/km.py', scienceKmPy)
  runtime.FS.writeFile('/home/pyodide/science/physical.py', sciencePhysicalPy)
  runtime.FS.writeFile('/home/pyodide/science/mixing.py', scienceMixingPy)
  runtime.FS.writeFile('/home/pyodide/science/paints.py', sciencePaintsPy)
  runtime.FS.writeFile('/home/pyodide/science/solve.py', scienceSolvePy)
  runtime.FS.writeFile('/home/pyodide/science/loop.py', scienceLoopPy)
  runtime.FS.writeFile('/home/pyodide/science/data/berns-artist-paint.json', bernsJson)
}

async function init(): Promise<string[]> {
  progress('Loading Pyodide…')
  const module = (await import(/* @vite-ignore */ `${PYODIDE_INDEX}pyodide.mjs`)) as PyodideModule
  pyodide = await module.loadPyodide({ indexURL: PYODIDE_INDEX })

  progress('Loading NumPy and SciPy…')
  await pyodide.loadPackage(['numpy', 'scipy', 'micropip'])

  progress('Installing ColorAide…')
  await pyodide.runPythonAsync(`
import micropip
await micropip.install('coloraide')
`)

  progress('Mounting science solver…')
  mountScience(pyodide)
  await pyodide.runPythonAsync(`
import sys
if "/home/pyodide" not in sys.path:
    sys.path.insert(0, "/home/pyodide")
`)

  progress('Starting ColorAide pipeline…')
  await pyodide.runPythonAsync(pipelinePy)
  return JSON.parse(call('list_spaces_json')) as string[]
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  try {
    switch (request.op) {
      case 'init': {
        const spaces = await init()
        reply({ id: request.id, ok: true, op: 'init', spaces })
        return
      }
      case 'fromHex': {
        const samples = JSON.parse(call('samples_from_hex_json', JSON.stringify(request.hexes)))
        reply({ id: request.id, ok: true, op: 'fromHex', samples })
        return
      }
      case 'fromLab': {
        const samples = JSON.parse(call('samples_from_lab_json', JSON.stringify(request.labs)))
        reply({ id: request.id, ok: true, op: 'fromLab', samples })
        return
      }
      case 'fromArgb': {
        const samples = JSON.parse(call('samples_from_argb_json', JSON.stringify(request.argbs)))
        reply({ id: request.id, ok: true, op: 'fromArgb', samples })
        return
      }
      case 'deltaE': {
        const value = JSON.parse(
          call(
            'delta_e_json',
            JSON.stringify({ a: request.a, b: request.b, method: request.method }),
          ),
        ) as number
        reply({ id: request.id, ok: true, op: 'deltaE', value })
        return
      }
      case 'convert': {
        const coords = JSON.parse(
          call('convert_json', JSON.stringify({ hex: request.hex, space: request.space })),
        ) as number[]
        reply({ id: request.id, ok: true, op: 'convert', coords })
        return
      }
      case 'listSpaces': {
        const spaces = JSON.parse(call('list_spaces_json')) as string[]
        reply({ id: request.id, ok: true, op: 'listSpaces', spaces })
        return
      }
      case 'solve': {
        const result = JSON.parse(call('solve_recipe_json', JSON.stringify(request.request)))
        reply({ id: request.id, ok: true, op: 'solve', result })
        return
      }
    }
  } catch (error) {
    reply({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : 'ColorAide worker failed',
    })
  }
}
