<div class="min-h-0 flex-1 overflow-auto">
  <div class="mx-auto max-w-2xl px-6 py-8">
    <p class="font-mono text-10px tracking-[0.2em] text-brass uppercase">Loop</p>
    <h1 class="mt-2 text-24px font-medium tracking-tight text-paper-100">Measurement</h1>
    <p class="mt-4 text-14px leading-relaxed text-paper-300">
      Predicted mix and measured mix are different observations. This panel is the place they will
      meet — after a recipe is weighed, mixed, and read under controlled light.
    </p>

    <ol class="mt-8 border border-rule">
      <li class="border-b border-rule px-4 py-3">
        <p class="font-mono text-10px tracking-wide text-paper-500 uppercase">Target</p>
        <p class="mt-1 text-13px text-paper-100">Digital palette color</p>
      </li>
      <li class="border-b border-rule px-4 py-3">
        <p class="font-mono text-10px tracking-wide text-paper-500 uppercase">Predicted</p>
        <p class="mt-1 text-13px text-paper-100">Model output for a constrained paint set</p>
      </li>
      <li class="px-4 py-3">
        <p class="font-mono text-10px tracking-wide text-paper-500 uppercase">Measured</p>
        <p class="mt-1 text-13px text-paper-100">
          Camera or spectrometer reading — not connected
        </p>
      </li>
    </ol>

    <p class="mt-6 text-12px leading-relaxed text-paper-500">
      Hardware integration is intentionally absent. A future scale (~0.001&nbsp;g) or dispenser
      should speak through <span class="font-mono text-paper-300">WeightRequest</span> /
      <span class="font-mono text-paper-300">MeasuredWeight</span>, not a vendor protocol.
    </p>
  </div>
</div>
