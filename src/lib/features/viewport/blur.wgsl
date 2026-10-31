struct BlurUniforms {
  dir: vec2f,
  sigma: f32,
  _pad: f32,
  size: vec2f,
}

@group(0) @binding(0) var<uniform> u: BlurUniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0),
  );
  return vec4f(positions[i], 0.0, 1.0);
}

@fragment
fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = pos.xy / max(u.size, vec2f(1.0));
  if u.sigma < 0.01 {
    return textureSampleLevel(tex, samp, uv, 0.0);
  }
  let texel = u.dir / max(u.size, vec2f(1.0));
  let radius = min(i32(ceil(u.sigma * 3.0)), 96);
  let two_s2 = 2.0 * u.sigma * u.sigma;
  var acc = vec4f(0.0);
  var wsum = 0.0;
  for (var i = -radius; i <= radius; i++) {
    let d = f32(i);
    let w = exp(-(d * d) / two_s2);
    let suv = clamp(uv + texel * d, vec2f(0.0), vec2f(1.0));
    acc += textureSampleLevel(tex, samp, suv, 0.0) * w;
    wsum += w;
  }
  return acc / max(wsum, 1.0e-6);
}
