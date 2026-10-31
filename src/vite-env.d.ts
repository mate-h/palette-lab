/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="@webgpu/types" />

declare module '*.wgsl?raw' {
  const source: string
  export default source
}

declare module '*.py?raw' {
  const source: string
  export default source
}

declare module '*.json?raw' {
  const source: string
  export default source
}
