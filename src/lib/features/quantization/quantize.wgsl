// Celebi quantizer compute stack: Wu initialization + Wsmeans (weighted k-means).
// Color science matches material-color-utilities (sRGB <-> Lab, D65).

const INDEX_BITS: u32 = 5u;
const SIDE_LENGTH: u32 = 33u;
const TOTAL_SIZE: u32 = 35937u;
const MAX_COLORS: u32 = 128u;
const MAX_POINTS: u32 = 32768u;
const SAMPLE_STRIDE: u32 = 4u;
const MIN_MOVEMENT_DISTANCE: f32 = 3.0;

const DIR_RED: u32 = 0u;
const DIR_GREEN: u32 = 1u;
const DIR_BLUE: u32 = 2u;

struct QuantizerSettings {
    max_colors: u32,
    dither: f32,
    enabled: u32,
    recompute: u32,
}

struct Histogram {
    weights: array<atomic<u32>, 35937>,
    moments_r: array<atomic<u32>, 35937>,
    moments_g: array<atomic<u32>, 35937>,
    moments_b: array<atomic<u32>, 35937>,
    moments2_lo: array<atomic<u32>, 35937>,
    moments2_hi: array<atomic<u32>, 35937>,
}

struct Point {
    lab: vec3<f32>,
    weight: f32,
}

struct Points {
    count: atomic<u32>,
    _pad0: u32,
    _pad1: u32,
    _pad2: u32,
    data: array<Point, 32768>,
    cluster_index: array<u32, 32768>,
}

struct Clusters {
    count: u32,
    _pad0: u32,
    _pad1: u32,
    _pad2: u32,
    rgb: array<vec4<f32>, 128>,
    lab: array<vec4<f32>, 128>,
    dist: array<f32, 16384>,
    dist_index: array<u32, 16384>,
}

struct Box {
    r0: i32,
    r1: i32,
    g0: i32,
    g1: i32,
    b0: i32,
    b1: i32,
    vol: i32,
    _pad: i32,
}

@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var<uniform> settings: QuantizerSettings;
@group(0) @binding(2) var<storage, read_write> histogram: Histogram;
@group(0) @binding(3) var<storage, read_write> points: Points;
@group(0) @binding(4) var<storage, read_write> clusters: Clusters;

fn get_index(r: u32, g: u32, b: u32) -> u32 {
    return (r << (INDEX_BITS * 2u)) + (r << (INDEX_BITS + 1u)) + r + (g << INDEX_BITS) + g + b;
}

fn max_colors() -> u32 {
    return clamp(settings.max_colors, 2u, MAX_COLORS);
}

fn linear_to_srgb_byte(linear: f32) -> u32 {
    let x = clamp(linear, 0.0, 1.0);
    var s: f32;
    if x <= 0.0031308 {
        s = x * 12.92;
    } else {
        s = 1.055 * pow(x, 1.0 / 2.4) - 0.055;
    }
    return u32(round(clamp(s, 0.0, 1.0) * 255.0));
}

fn p3_to_linear_srgb(p3: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(
        1.2249401763 * p3.r - 0.2249402171 * p3.g,
        -0.0420569546 * p3.r + 1.0420569754 * p3.g,
        -0.0196375545 * p3.r - 0.0786360455 * p3.g + 1.0982736000 * p3.b,
    );
}

fn tone_map_srgb(linear: vec3<f32>) -> vec3<f32> {
    let y = max(dot(linear, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0);
    if y <= 1.0 {
        return clamp(linear, vec3<f32>(0.0), vec3<f32>(1.0));
    }
    return clamp(linear / (1.0 + y), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn linearized(byte: u32) -> f32 {
    let n = f32(byte) / 255.0;
    if n <= 0.040449936 {
        return n / 12.92 * 100.0;
    }
    return pow((n + 0.055) / 1.055, 2.4) * 100.0;
}

fn lab_f(t: f32) -> f32 {
    let e = 216.0 / 24389.0;
    let kappa = 24389.0 / 27.0;
    if t > e {
        return pow(t, 1.0 / 3.0);
    }
    return (kappa * t + 16.0) / 116.0;
}

fn lab_inv_f(ft: f32) -> f32 {
    let e = 216.0 / 24389.0;
    let kappa = 24389.0 / 27.0;
    let ft3 = ft * ft * ft;
    if ft3 > e {
        return ft3;
    }
    return (116.0 * ft - 16.0) / kappa;
}

fn lab_from_rgb_bytes(r: u32, g: u32, b: u32) -> vec3<f32> {
    let lr = linearized(r);
    let lg = linearized(g);
    let lb = linearized(b);
    let x = 0.41233895 * lr + 0.35762064 * lg + 0.18051042 * lb;
    let y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    let z = 0.01932141 * lr + 0.11916382 * lg + 0.95034478 * lb;
    let fx = lab_f(x / 95.047);
    let fy = lab_f(y / 100.0);
    let fz = lab_f(z / 108.883);
    return vec3<f32>(116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz));
}

fn lab_to_linear_rgb(lab: vec3<f32>) -> vec3<f32> {
    let fy = (lab.x + 16.0) / 116.0;
    let fx = lab.y / 500.0 + fy;
    let fz = fy - lab.z / 200.0;
    let x = lab_inv_f(fx) * 95.047;
    let y = lab_inv_f(fy) * 100.0;
    let z = lab_inv_f(fz) * 108.883;
    let lr = 3.2413774792388685 * x + -1.5376652402851851 * y + -0.49885366846268053 * z;
    let lg = -0.9691452513005321 * x + 1.8758853451067872 * y + 0.04156585616912061 * z;
    let lb = 0.05562093689691305 * x + -0.20395524564742123 * y + 1.0571799111220335 * z;
    return vec3<f32>(lr, lg, lb) / 100.0;
}

fn lab_dist2(a: vec3<f32>, b: vec3<f32>) -> f32 {
    let d = a - b;
    return dot(d, d);
}

fn add_u64(a_lo: u32, a_hi: u32, b_lo: u32, b_hi: u32) -> vec2<u32> {
    let lo = a_lo + b_lo;
    var carry = 0u;
    if lo < a_lo {
        carry = 1u;
    }
    return vec2<u32>(lo, a_hi + b_hi + carry);
}

fn atomic_add_u64(index: u32, val: u32) {
    let old = atomicAdd(&histogram.moments2_lo[index], val);
    if old + val < old {
        atomicAdd(&histogram.moments2_hi[index], 1u);
    }
}

fn load_m2(index: u32) -> vec2<u32> {
    return vec2<u32>(
        atomicLoad(&histogram.moments2_lo[index]),
        atomicLoad(&histogram.moments2_hi[index]),
    );
}

fn store_m2(index: u32, v: vec2<u32>) {
    atomicStore(&histogram.moments2_lo[index], v.x);
    atomicStore(&histogram.moments2_hi[index], v.y);
}

fn m2_as_f32(v: vec2<u32>) -> f32 {
    return f32(v.x) + f32(v.y) * 4294967296.0;
}

fn load_moment(kind: u32, index: u32) -> i32 {
    switch kind {
        case 0u: { return i32(atomicLoad(&histogram.weights[index])); }
        case 1u: { return i32(atomicLoad(&histogram.moments_r[index])); }
        case 2u: { return i32(atomicLoad(&histogram.moments_g[index])); }
        case 3u: { return i32(atomicLoad(&histogram.moments_b[index])); }
        default: { return 0; }
    }
}

fn volume_m2(cube: Box) -> f32 {
    return m2_as_f32(load_m2(get_index(u32(cube.r1), u32(cube.g1), u32(cube.b1))))
        - m2_as_f32(load_m2(get_index(u32(cube.r1), u32(cube.g1), u32(cube.b0))))
        - m2_as_f32(load_m2(get_index(u32(cube.r1), u32(cube.g0), u32(cube.b1))))
        + m2_as_f32(load_m2(get_index(u32(cube.r1), u32(cube.g0), u32(cube.b0))))
        - m2_as_f32(load_m2(get_index(u32(cube.r0), u32(cube.g1), u32(cube.b1))))
        + m2_as_f32(load_m2(get_index(u32(cube.r0), u32(cube.g1), u32(cube.b0))))
        + m2_as_f32(load_m2(get_index(u32(cube.r0), u32(cube.g0), u32(cube.b1))))
        - m2_as_f32(load_m2(get_index(u32(cube.r0), u32(cube.g0), u32(cube.b0))));
}

fn volume(cube: Box, kind: u32) -> i32 {
    return load_moment(kind, get_index(u32(cube.r1), u32(cube.g1), u32(cube.b1)))
        - load_moment(kind, get_index(u32(cube.r1), u32(cube.g1), u32(cube.b0)))
        - load_moment(kind, get_index(u32(cube.r1), u32(cube.g0), u32(cube.b1)))
        + load_moment(kind, get_index(u32(cube.r1), u32(cube.g0), u32(cube.b0)))
        - load_moment(kind, get_index(u32(cube.r0), u32(cube.g1), u32(cube.b1)))
        + load_moment(kind, get_index(u32(cube.r0), u32(cube.g1), u32(cube.b0)))
        + load_moment(kind, get_index(u32(cube.r0), u32(cube.g0), u32(cube.b1)))
        - load_moment(kind, get_index(u32(cube.r0), u32(cube.g0), u32(cube.b0)));
}

fn bottom(cube: Box, direction: u32, kind: u32) -> i32 {
    switch direction {
        case 0u: {
            return -load_moment(kind, get_index(u32(cube.r0), u32(cube.g1), u32(cube.b1)))
                + load_moment(kind, get_index(u32(cube.r0), u32(cube.g1), u32(cube.b0)))
                + load_moment(kind, get_index(u32(cube.r0), u32(cube.g0), u32(cube.b1)))
                - load_moment(kind, get_index(u32(cube.r0), u32(cube.g0), u32(cube.b0)));
        }
        case 1u: {
            return -load_moment(kind, get_index(u32(cube.r1), u32(cube.g0), u32(cube.b1)))
                + load_moment(kind, get_index(u32(cube.r1), u32(cube.g0), u32(cube.b0)))
                + load_moment(kind, get_index(u32(cube.r0), u32(cube.g0), u32(cube.b1)))
                - load_moment(kind, get_index(u32(cube.r0), u32(cube.g0), u32(cube.b0)));
        }
        default: {
            return -load_moment(kind, get_index(u32(cube.r1), u32(cube.g1), u32(cube.b0)))
                + load_moment(kind, get_index(u32(cube.r1), u32(cube.g0), u32(cube.b0)))
                + load_moment(kind, get_index(u32(cube.r0), u32(cube.g1), u32(cube.b0)))
                - load_moment(kind, get_index(u32(cube.r0), u32(cube.g0), u32(cube.b0)));
        }
    }
}

fn top(cube: Box, direction: u32, position: i32, kind: u32) -> i32 {
    switch direction {
        case 0u: {
            return load_moment(kind, get_index(u32(position), u32(cube.g1), u32(cube.b1)))
                - load_moment(kind, get_index(u32(position), u32(cube.g1), u32(cube.b0)))
                - load_moment(kind, get_index(u32(position), u32(cube.g0), u32(cube.b1)))
                + load_moment(kind, get_index(u32(position), u32(cube.g0), u32(cube.b0)));
        }
        case 1u: {
            return load_moment(kind, get_index(u32(cube.r1), u32(position), u32(cube.b1)))
                - load_moment(kind, get_index(u32(cube.r1), u32(position), u32(cube.b0)))
                - load_moment(kind, get_index(u32(cube.r0), u32(position), u32(cube.b1)))
                + load_moment(kind, get_index(u32(cube.r0), u32(position), u32(cube.b0)));
        }
        default: {
            return load_moment(kind, get_index(u32(cube.r1), u32(cube.g1), u32(position)))
                - load_moment(kind, get_index(u32(cube.r1), u32(cube.g0), u32(position)))
                - load_moment(kind, get_index(u32(cube.r0), u32(cube.g1), u32(position)))
                + load_moment(kind, get_index(u32(cube.r0), u32(cube.g0), u32(position)));
        }
    }
}

fn cube_variance(cube: Box) -> f32 {
    let dr = f32(volume(cube, 1u));
    let dg = f32(volume(cube, 2u));
    let db = f32(volume(cube, 3u));
    let xx = volume_m2(cube);
    let hypotenuse = dr * dr + dg * dg + db * db;
    let vol = f32(volume(cube, 0u));
    if vol <= 0.0 {
        return 0.0;
    }
    return xx - hypotenuse / vol;
}

fn maximize(cube: Box, direction: u32, first: i32, last: i32, whole_r: i32, whole_g: i32, whole_b: i32, whole_w: i32) -> vec2<f32> {
    let bottom_r = bottom(cube, direction, 1u);
    let bottom_g = bottom(cube, direction, 2u);
    let bottom_b = bottom(cube, direction, 3u);
    let bottom_w = bottom(cube, direction, 0u);
    var max_v = 0.0;
    var cut = -1;

    for (var i = first; i < last; i++) {
        var half_r = bottom_r + top(cube, direction, i, 1u);
        var half_g = bottom_g + top(cube, direction, i, 2u);
        var half_b = bottom_b + top(cube, direction, i, 3u);
        var half_w = bottom_w + top(cube, direction, i, 0u);
        if half_w == 0 {
            continue;
        }
        var temp = (f32(half_r) * f32(half_r) + f32(half_g) * f32(half_g) + f32(half_b) * f32(half_b)) / f32(half_w);
        half_r = whole_r - half_r;
        half_g = whole_g - half_g;
        half_b = whole_b - half_b;
        half_w = whole_w - half_w;
        if half_w == 0 {
            continue;
        }
        temp = temp + (f32(half_r) * f32(half_r) + f32(half_g) * f32(half_g) + f32(half_b) * f32(half_b)) / f32(half_w);
        if temp > max_v {
            max_v = temp;
            cut = i;
        }
    }
    return vec2<f32>(f32(cut), max_v);
}

@compute @workgroup_size(256, 1, 1)
fn clear(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.x;
    if i == 0u {
        atomicStore(&points.count, 0u);
        clusters.count = 0u;
    }
    if i >= TOTAL_SIZE {
        return;
    }
    atomicStore(&histogram.weights[i], 0u);
    atomicStore(&histogram.moments_r[i], 0u);
    atomicStore(&histogram.moments_g[i], 0u);
    atomicStore(&histogram.moments_b[i], 0u);
    atomicStore(&histogram.moments2_lo[i], 0u);
    atomicStore(&histogram.moments2_hi[i], 0u);
}

@compute @workgroup_size(8, 8, 1)
fn accumulate(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dims = textureDimensions(source);
    let x = gid.x * SAMPLE_STRIDE;
    let y = gid.y * SAMPLE_STRIDE;
    if x >= dims.x || y >= dims.y {
        return;
    }
    let color = textureLoad(source, vec2<i32>(i32(x), i32(y)), 0);
    let mapped = tone_map_srgb(p3_to_linear_srgb(color.rgb));
    let r = linear_to_srgb_byte(mapped.r);
    let g = linear_to_srgb_byte(mapped.g);
    let b = linear_to_srgb_byte(mapped.b);
    let i_r = (r >> 3u) + 1u;
    let i_g = (g >> 3u) + 1u;
    let i_b = (b >> 3u) + 1u;
    let index = get_index(i_r, i_g, i_b);
    atomicAdd(&histogram.weights[index], 1u);
    atomicAdd(&histogram.moments_r[index], r);
    atomicAdd(&histogram.moments_g[index], g);
    atomicAdd(&histogram.moments_b[index], b);
    atomic_add_u64(index, r * r + g * g + b * b);
}

@compute @workgroup_size(256, 1, 1)
fn compact(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.x;
    if i >= TOTAL_SIZE {
        return;
    }
    let w = atomicLoad(&histogram.weights[i]);
    if w == 0u {
        return;
    }
    let r = atomicLoad(&histogram.moments_r[i]) / w;
    let g = atomicLoad(&histogram.moments_g[i]) / w;
    let b = atomicLoad(&histogram.moments_b[i]) / w;
    let idx = atomicAdd(&points.count, 1u);
    if idx >= MAX_POINTS {
        return;
    }
    points.data[idx] = Point(lab_from_rgb_bytes(r, g, b), f32(w));
    points.cluster_index[idx] = 0u;
}

@compute @workgroup_size(1, 1, 1)
fn moments() {
    for (var r = 1u; r < SIDE_LENGTH; r++) {
        var area: array<u32, 33>;
        var area_r: array<u32, 33>;
        var area_g: array<u32, 33>;
        var area_b: array<u32, 33>;
        var area2_lo: array<u32, 33>;
        var area2_hi: array<u32, 33>;
        for (var z = 0u; z < SIDE_LENGTH; z++) {
            area[z] = 0u;
            area_r[z] = 0u;
            area_g[z] = 0u;
            area_b[z] = 0u;
            area2_lo[z] = 0u;
            area2_hi[z] = 0u;
        }
        for (var g = 1u; g < SIDE_LENGTH; g++) {
            var line = 0u;
            var line_r = 0u;
            var line_g = 0u;
            var line_b = 0u;
            var line2 = vec2<u32>(0u, 0u);
            for (var b = 1u; b < SIDE_LENGTH; b++) {
                let index = get_index(r, g, b);
                line += atomicLoad(&histogram.weights[index]);
                line_r += atomicLoad(&histogram.moments_r[index]);
                line_g += atomicLoad(&histogram.moments_g[index]);
                line_b += atomicLoad(&histogram.moments_b[index]);
                line2 = add_u64(line2.x, line2.y, atomicLoad(&histogram.moments2_lo[index]), atomicLoad(&histogram.moments2_hi[index]));
                area[b] += line;
                area_r[b] += line_r;
                area_g[b] += line_g;
                area_b[b] += line_b;
                let area2 = add_u64(area2_lo[b], area2_hi[b], line2.x, line2.y);
                area2_lo[b] = area2.x;
                area2_hi[b] = area2.y;
                let prev = get_index(r - 1u, g, b);
                atomicStore(&histogram.weights[index], atomicLoad(&histogram.weights[prev]) + area[b]);
                atomicStore(&histogram.moments_r[index], atomicLoad(&histogram.moments_r[prev]) + area_r[b]);
                atomicStore(&histogram.moments_g[index], atomicLoad(&histogram.moments_g[prev]) + area_g[b]);
                atomicStore(&histogram.moments_b[index], atomicLoad(&histogram.moments_b[prev]) + area_b[b]);
                let prefix2 = add_u64(
                    atomicLoad(&histogram.moments2_lo[prev]),
                    atomicLoad(&histogram.moments2_hi[prev]),
                    area2_lo[b],
                    area2_hi[b],
                );
                store_m2(index, prefix2);
            }
        }
    }
}

@compute @workgroup_size(1, 1, 1)
fn wu() {
    var cubes: array<Box, 128>;
    var volume_variance: array<f32, 128>;
    let k = max_colors();
    cubes[0].r0 = 0;
    cubes[0].g0 = 0;
    cubes[0].b0 = 0;
    cubes[0].r1 = i32(SIDE_LENGTH) - 1;
    cubes[0].g1 = i32(SIDE_LENGTH) - 1;
    cubes[0].b1 = i32(SIDE_LENGTH) - 1;
    cubes[0].vol = 0;

    var generated = k;
    var next = 0u;
    var i = 1u;
    loop {
        if i >= k {
            break;
        }
        var cut_ok = false;
        {
            let one = cubes[next];
            let whole_r = volume(one, 1u);
            let whole_g = volume(one, 2u);
            let whole_b = volume(one, 3u);
            let whole_w = volume(one, 0u);
            let max_r = maximize(one, DIR_RED, one.r0 + 1, one.r1, whole_r, whole_g, whole_b, whole_w);
            let max_g = maximize(one, DIR_GREEN, one.g0 + 1, one.g1, whole_r, whole_g, whole_b, whole_w);
            let max_b = maximize(one, DIR_BLUE, one.b0 + 1, one.b1, whole_r, whole_g, whole_b, whole_w);
            var direction = DIR_BLUE;
            if max_r.y >= max_g.y && max_r.y >= max_b.y {
                if max_r.x < 0.0 {
                    volume_variance[next] = 0.0;
                } else {
                    direction = DIR_RED;
                    cut_ok = true;
                }
            } else if max_g.y >= max_r.y && max_g.y >= max_b.y {
                direction = DIR_GREEN;
                cut_ok = true;
            } else {
                direction = DIR_BLUE;
                cut_ok = true;
            }

            if cut_ok {
                var a = cubes[next];
                var b = cubes[i];
                b.r1 = a.r1;
                b.g1 = a.g1;
                b.b1 = a.b1;
                if direction == DIR_RED {
                    a.r1 = i32(max_r.x);
                    b.r0 = a.r1;
                    b.g0 = a.g0;
                    b.b0 = a.b0;
                } else if direction == DIR_GREEN {
                    a.g1 = i32(max_g.x);
                    b.r0 = a.r0;
                    b.g0 = a.g1;
                    b.b0 = a.b0;
                } else {
                    a.b1 = i32(max_b.x);
                    b.r0 = a.r0;
                    b.g0 = a.g0;
                    b.b0 = a.b1;
                }
                a.vol = (a.r1 - a.r0) * (a.g1 - a.g0) * (a.b1 - a.b0);
                b.vol = (b.r1 - b.r0) * (b.g1 - b.g0) * (b.b1 - b.b0);
                cubes[next] = a;
                cubes[i] = b;
                if a.vol > 1 {
                    volume_variance[next] = cube_variance(a);
                } else {
                    volume_variance[next] = 0.0;
                }
                if b.vol > 1 {
                    volume_variance[i] = cube_variance(b);
                } else {
                    volume_variance[i] = 0.0;
                }
            }
        }

        next = 0u;
        var temp = volume_variance[0];
        for (var j = 1u; j <= i; j++) {
            if volume_variance[j] > temp {
                temp = volume_variance[j];
                next = j;
            }
        }
        if temp <= 0.0 {
            generated = i + 1u;
            break;
        }
        if cut_ok {
            i = i + 1u;
        }
    }

    var out_count = 0u;
    for (var c = 0u; c < generated; c++) {
        let cube = cubes[c];
        let weight = volume(cube, 0u);
        if weight <= 0 {
            continue;
        }
        let r = u32(round(f32(volume(cube, 1u)) / f32(weight)));
        let g = u32(round(f32(volume(cube, 2u)) / f32(weight)));
        let b = u32(round(f32(volume(cube, 3u)) / f32(weight)));
        let lab = lab_from_rgb_bytes(r, g, b);
        clusters.lab[out_count] = vec4<f32>(lab, 0.0);
        clusters.rgb[out_count] = vec4<f32>(lab_to_linear_rgb(lab), 1.0);
        out_count = out_count + 1u;
    }
    clusters.count = out_count;
}

@compute @workgroup_size(256, 1, 1)
fn wsmeans_init(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.x;
    let n = atomicLoad(&points.count);
    let k = clusters.count;
    if i >= n || i >= MAX_POINTS || k == 0u {
        return;
    }
    let point = points.data[i].lab;
    var best = 0u;
    var best_d = 1.0e20;
    for (var j = 0u; j < k; j++) {
        let d = lab_dist2(point, clusters.lab[j].xyz);
        if d < best_d {
            best_d = d;
            best = j;
        }
    }
    points.cluster_index[i] = best;
}

@compute @workgroup_size(128, 1, 1)
fn wsmeans_distances(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.x;
    let k = clusters.count;
    if i >= k {
        return;
    }
    let a = clusters.lab[i].xyz;
    for (var j = 0u; j < k; j++) {
        let d = lab_dist2(a, clusters.lab[j].xyz);
        clusters.dist[i * MAX_COLORS + j] = d;
        clusters.dist_index[i * MAX_COLORS + j] = j;
    }
    for (var a_i = 1u; a_i < k; a_i++) {
        let key_d = clusters.dist[i * MAX_COLORS + a_i];
        let key_j = clusters.dist_index[i * MAX_COLORS + a_i];
        var b_i = i32(a_i);
        loop {
            if b_i <= 0 {
                break;
            }
            let prev = u32(b_i - 1);
            if clusters.dist[i * MAX_COLORS + prev] <= key_d {
                break;
            }
            clusters.dist[i * MAX_COLORS + u32(b_i)] = clusters.dist[i * MAX_COLORS + prev];
            clusters.dist_index[i * MAX_COLORS + u32(b_i)] = clusters.dist_index[i * MAX_COLORS + prev];
            b_i = b_i - 1;
        }
        clusters.dist[i * MAX_COLORS + u32(b_i)] = key_d;
        clusters.dist_index[i * MAX_COLORS + u32(b_i)] = key_j;
    }
}

@compute @workgroup_size(256, 1, 1)
fn wsmeans_assign(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.x;
    let n = atomicLoad(&points.count);
    let k = clusters.count;
    if i >= n || i >= MAX_POINTS || k == 0u {
        return;
    }
    let point = points.data[i].lab;
    let prev_i = points.cluster_index[i];
    let prev_cluster = clusters.lab[prev_i].xyz;
    let prev_d = lab_dist2(point, prev_cluster);
    var min_d = prev_d;
    var new_i = 0xffffffffu;
    for (var j = 0u; j < k; j++) {
        let neighbor = clusters.dist_index[prev_i * MAX_COLORS + j];
        if j > 0u && clusters.dist[prev_i * MAX_COLORS + j] >= 4.0 * prev_d {
            break;
        }
        let d = lab_dist2(point, clusters.lab[neighbor].xyz);
        if d < min_d {
            min_d = d;
            new_i = neighbor;
        }
    }
    if new_i != 0xffffffffu {
        let change = abs(sqrt(min_d) - sqrt(prev_d));
        if change > MIN_MOVEMENT_DISTANCE {
            points.cluster_index[i] = new_i;
        }
    }
}

@compute @workgroup_size(128, 1, 1)
fn wsmeans_update(@builtin(global_invocation_id) gid: vec3<u32>) {
    let c = gid.x;
    let k = clusters.count;
    let n = atomicLoad(&points.count);
    if c >= k {
        return;
    }
    var sum = vec3<f32>(0.0);
    var wsum = 0.0;
    let n_clamped = min(n, MAX_POINTS);
    for (var i = 0u; i < n_clamped; i++) {
        if points.cluster_index[i] == c {
            let p = points.data[i];
            sum += p.lab * p.weight;
            wsum += p.weight;
        }
    }
    if wsum <= 0.0 {
        return;
    }
    clusters.lab[c] = vec4<f32>(sum / wsum, wsum);
}

@compute @workgroup_size(128, 1, 1)
fn wsmeans_finalize(@builtin(global_invocation_id) gid: vec3<u32>) {
    let c = gid.x;
    let k = clusters.count;
    if c >= k {
        return;
    }
    let lab = clusters.lab[c].xyz;
    clusters.rgb[c] = vec4<f32>(lab_to_linear_rgb(lab), 1.0);
}
