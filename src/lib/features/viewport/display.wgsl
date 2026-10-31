struct Uniforms {
  pan: vec2f,
  zoom: f32,
  _pad: f32,
  canvas: vec2f,
  image: vec2f,
  bg: vec4f,
  highlight_index: i32,
  highlight_mode: u32,
  remap: u32,
  output_hdr: u32,
}

struct Clusters {
  count: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
  rgb: array<vec4f, 128>,
  lab: array<vec4f, 128>,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;
@group(0) @binding(3) var<storage, read> clusters: Clusters;

struct VSOut {
  @builtin(position) pos: vec4f,
}

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VSOut {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0),
  );
  var out: VSOut;
  out.pos = vec4f(positions[i], 0.0, 1.0);
  return out;
}

fn linearized(byte: f32) -> f32 {
  let n = byte / 255.0;
  if n <= 0.040449936 {
    return n / 12.92 * 100.0;
  }
  return pow((n + 0.055) / 1.055, 2.4) * 100.0;
}

fn linear_to_srgb(x: f32) -> f32 {
  let c = clamp(x, 0.0, 1.0);
  if c <= 0.0031308 {
    return c * 12.92;
  }
  return 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}

fn decode_srgb_channel(c: f32) -> f32 {
  if c <= 0.04045 {
    return c / 12.92;
  }
  return pow((c + 0.055) / 1.055, 2.4);
}

fn decode_srgb(rgb: vec3f) -> vec3f {
  return vec3f(decode_srgb_channel(rgb.r), decode_srgb_channel(rgb.g), decode_srgb_channel(rgb.b));
}

fn p3_to_linear_srgb(p3: vec3f) -> vec3f {
  return vec3f(
    1.2249401763 * p3.r - 0.2249402171 * p3.g,
    -0.0420569546 * p3.r + 1.0420569754 * p3.g,
    -0.0196375545 * p3.r - 0.0786360455 * p3.g + 1.0982736000 * p3.b,
  );
}

fn linear_srgb_to_p3(srgb: vec3f) -> vec3f {
  return vec3f(
    0.822461969 * srgb.r + 0.177538031 * srgb.g,
    0.033194199 * srgb.r + 0.966805801 * srgb.g,
    0.017082631 * srgb.r + 0.072397440 * srgb.g + 0.910519929 * srgb.b,
  );
}

fn lab_f(t: f32) -> f32 {
  let e = 216.0 / 24389.0;
  let kappa = 24389.0 / 27.0;
  if t > e {
    return pow(t, 1.0 / 3.0);
  }
  return (kappa * t + 16.0) / 116.0;
}

fn lab_from_linear_srgb(rgb: vec3f) -> vec3f {
  let r = linearized(linear_to_srgb(rgb.r) * 255.0);
  let g = linearized(linear_to_srgb(rgb.g) * 255.0);
  let b = linearized(linear_to_srgb(rgb.b) * 255.0);
  let x = 0.41233895 * r + 0.35762064 * g + 0.18051042 * b;
  let y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  let z = 0.01932141 * r + 0.11916382 * g + 0.95034478 * b;
  let fx = lab_f(x / 95.047);
  let fy = lab_f(y / 100.0);
  let fz = lab_f(z / 108.883);
  return vec3f(116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz));
}

fn encode_srgb(linear: vec3f) -> vec3f {
  return vec3f(linear_to_srgb(linear.r), linear_to_srgb(linear.g), linear_to_srgb(linear.b));
}

fn nearest_index(linear_srgb: vec3f) -> u32 {
  let lab = lab_from_linear_srgb(linear_srgb);
  var best = 0u;
  var best_d = 1.0e20;
  for (var i = 0u; i < clusters.count; i++) {
    let d = lab - clusters.lab[i].xyz;
    let dist = dot(d, d);
    if dist < best_d {
      best_d = dist;
      best = i;
    }
  }
  return best;
}

fn relative_y(linear_srgb: vec3f) -> f32 {
  return dot(max(linear_srgb, vec3f(0.0)), vec3f(0.2126, 0.7152, 0.0722));
}

/** Brunaille ramp: dark umber → Golden-style burnt umber masstone → warm white. */
fn underpaint_umber(linear_srgb: vec3f) -> vec3f {
  let y = clamp(relative_y(linear_srgb), 0.0, 1.0);
  let t = pow(y, 0.92);
  let dark = decode_srgb(vec3f(0.086, 0.043, 0.024));
  let umber = decode_srgb(vec3f(0.361, 0.165, 0.071));
  let light = decode_srgb(vec3f(0.953, 0.933, 0.894));
  if t < 0.42 {
    return mix(dark, umber, t / 0.42);
  }
  return mix(umber, light, (t - 0.42) / 0.58);
}

fn apply_highlight(shown: vec4f, index: u32) -> vec4f {
  if u.highlight_mode == 0u || u.highlight_index < 0 || clusters.count == 0u {
    return shown;
  }
  let matched = i32(index) == u.highlight_index;
  if u.highlight_mode == 1u {
    if matched {
      return shown;
    }
    return vec4f(mix(letterbox().rgb, shown.rgb, 0.06), shown.a);
  }
  let selected = u32(clamp(u.highlight_index, 0, i32(clusters.count) - 1));
  let light = clusters.lab[selected].x < 50.0;
  let shape = select(vec3f(0.0), vec3f(1.0), light);
  if matched {
    return vec4f(shape, 1.0);
  }
  return vec4f(1.0 - shape, 1.0);
}

fn to_canvas(linear_srgb: vec3f) -> vec3f {
  if u.output_hdr != 0u {
    return linear_srgb_to_p3(linear_srgb);
  }
  return encode_srgb(linear_srgb);
}

fn letterbox() -> vec4f {
  if u.output_hdr != 0u {
    return vec4f(linear_srgb_to_p3(decode_srgb(u.bg.rgb)), u.bg.a);
  }
  return u.bg;
}

@fragment
fn fs(@builtin(position) frag: vec4f) -> @location(0) vec4f {
  let canvas = u.canvas;
  let image = u.image;
  let px = frag.xy;
  let fit = min(canvas.x / max(image.x, 1.0), canvas.y / max(image.y, 1.0));
  let scale = fit * max(u.zoom, 0.001);
  let origin = (canvas - image * scale) * 0.5 + u.pan;
  let img_px = (px - origin) / scale;
  let uv = img_px / image;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
    return letterbox();
  }
  let linear_p3 = textureSampleLevel(tex, samp, uv, 0.0);
  let linear_srgb = p3_to_linear_srgb(linear_p3.rgb);
  var linear_shown = linear_srgb;
  var index = 0u;
  if clusters.count > 0u {
    index = nearest_index(linear_srgb);
    if (u.remap & 1u) != 0u {
      linear_shown = clusters.rgb[index].xyz;
    }
  }
  if (u.remap & 2u) != 0u {
    linear_shown = underpaint_umber(linear_shown);
  }
  return apply_highlight(vec4f(to_canvas(linear_shown), linear_p3.a), index);
}
