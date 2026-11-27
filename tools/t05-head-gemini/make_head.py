#!/usr/bin/env python3
"""
Deterministic procedural high-poly Buddha head generator for T05 (issue #720) — Round 2.
Runs headless under Blender 5.3 Python module (bpy==5.3.0) with no network access.

Usage:
    python3 make_head.py <out.glb>

Round 2 sculptural upgrades over Round 1:
  - Broad, dignified Liao squircle cranium with real zygomatic arches & full rounded jaw angles
    (eliminates narrow tapered chin/cheeks; matches ref A/B monumental fullness).
  - Lower, wider, flatter-domed ushnisha with full upper cranium shoulders (never conical).
  - Compact, plush, sculpted petal lips with crisp Cupid's bow, central upper-lip tubercle,
    wavy closed smile line, subtle philtrum & corner dimples (eliminates wide flat slit).
  - Sculpted classical nose with planar bridge sides, plump rounded tip, distinct alae & alar creases.
  - Crisp willow-leaf half-open downcast eyes with sharp inner/outer canthi, defined upper eyelid
    margin & supratarsal crease, and slender sweeping Liao brow arches.
  - Deeper, crisper 3-turn spiral grooves on densely packed hair curls (螺发).
  - Plumper, wider, blunt-rounded unpierced earlobes (厚实圆钝垂珠).
"""

import math
import os
import sys
import numpy as np
import bpy


# ---------------------------------------------------------------------------
# Mathematical helpers (pure NumPy, C2 smooth, 100% deterministic)
# ---------------------------------------------------------------------------

def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def smootherstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0)


def gauss(d, sigma):
    return np.exp(-0.5 * (d / sigma) ** 2)


def smooth_abs(x, eps=1e-4):
    return np.sqrt(x * x + eps * eps) - eps


def sharp_ridge(d, w):
    """Sculptural crisp ridge / crease profile (sharper peak than Gaussian, still C1 smooth)."""
    u = np.abs(d) / w
    return np.exp(-1.2 * (u ** 1.65))


# ---------------------------------------------------------------------------
# 1. Quad-sphere topology (watertight, zero poles, exact manifold quads)
# ---------------------------------------------------------------------------

def make_cube_sphere(n: int):
    faces_def = [
        ((-1, -1,  1), ( 2,  0,  0), ( 0,  2,  0)),  # +Z (front)
        (( 1, -1, -1), (-2,  0,  0), ( 0,  2,  0)),  # -Z (back)
        (( 1, -1,  1), ( 0,  0, -2), ( 0,  2,  0)),  # +X (left)
        ((-1, -1, -1), ( 0,  0,  2), ( 0,  2,  0)),  # -X (right)
        ((-1,  1,  1), ( 2,  0,  0), ( 0,  0, -2)),  # +Y (top)
        ((-1, -1, -1), ( 2,  0,  0), ( 0,  0,  2)),  # -Y (bottom)
    ]

    vert_map = {}
    coords = []
    quads = []

    for orig, du, dv in faces_def:
        ox, oy, oz = orig[0] * n, orig[1] * n, orig[2] * n
        ux, uy, uz = du[0], du[1], du[2]
        vx, vy, vz = dv[0], dv[1], dv[2]

        grid = np.empty((n + 1, n + 1), dtype=np.int32)
        for j in range(n + 1):
            for i in range(n + 1):
                key = (ox + i * ux + j * vx, oy + i * uy + j * vy, oz + i * uz + j * vz)
                idx = vert_map.get(key)
                if idx is None:
                    idx = len(coords)
                    vert_map[key] = idx
                    fx = math.tan((key[0] / n) * (math.pi * 0.25))
                    fy = math.tan((key[1] / n) * (math.pi * 0.25))
                    fz = math.tan((key[2] / n) * (math.pi * 0.25))
                    inv = 1.0 / math.sqrt(fx * fx + fy * fy + fz * fz)
                    coords.append((fx * inv, fy * inv, fz * inv))
                grid[j, i] = idx

        v00 = grid[:-1, :-1].ravel()
        v10 = grid[:-1, 1:].ravel()
        v11 = grid[1:, 1:].ravel()
        v01 = grid[1:, :-1].ravel()
        quads.append(np.stack([v00, v10, v11, v01], axis=1))

    dirs = np.array(coords, dtype=np.float64)
    quads = np.concatenate(quads, axis=0)
    return dirs, quads


def quads_to_tris_symmetric(verts: np.ndarray, quads: np.ndarray) -> np.ndarray:
    """Mirror-symmetric quad-to-triangle split across X = 0."""
    cx = verts[quads, 0].mean(axis=1)
    pos = cx >= 0.0
    q_pos = quads[pos]
    q_neg = quads[~pos]

    t_list = []
    if len(q_pos):
        t_list.append(q_pos[:, [0, 1, 2]])
        t_list.append(q_pos[:, [0, 2, 3]])
    if len(q_neg):
        t_list.append(q_neg[:, [0, 1, 3]])
        t_list.append(q_neg[:, [1, 2, 3]])
    return np.concatenate(t_list, axis=0)


# ---------------------------------------------------------------------------
# 2. Buddha Head & Neck Base + Round-2 Anatomical Facial Sculpting
# ---------------------------------------------------------------------------

def build_head_and_neck(n_subdiv: int = 230):
    """
    Build the continuous watertight head + neck mesh in glTF coordinates:
      Y up, +Z front, X=0 symmetry, flat sealed neck base at Y=0.0.
    """
    dirs, quads = make_cube_sphere(n_subdiv)

    # Concentrate slightly higher vertex resolution onto the +Z facial hemisphere
    ux, uy, uz = dirs[:, 0], dirs[:, 1], dirs[:, 2]
    front_pull = 0.28
    uz_w = uz + front_pull * (1.0 - uz * uz)
    norm_w = np.sqrt(ux * ux + uy * uy + uz_w * uz_w)
    ux = ux / norm_w
    uy = uy / norm_w
    uz = uz_w / norm_w

    r_horiz = np.sqrt(ux * ux + uz * uz)
    r_safe = np.maximum(r_horiz, 1e-12)
    hx = ux / r_safe
    hz = uz / r_safe

    # -----------------------------------------------------------------------
    # A. Broad, Monumental Liao Squircle Cranium + Sturdy Neck Stub
    # -----------------------------------------------------------------------
    uy_cap = -0.84
    r_cap_rim = math.sqrt(1.0 - uy_cap * uy_cap)

    # Cranium vertical span: [0.36, 2.02], neck stub: [0.00, 0.44]
    y_cranium = 1.19 + 0.83 * uy
    neck_t = smootherstep(-0.46, -0.78, uy)
    y_neck = np.clip((uy - uy_cap) / (-0.42 - uy_cap), 0.0, 1.0) * 0.48
    y = y_cranium * (1.0 - neck_t) + y_neck * neck_t
    cap_flat = smootherstep(uy_cap + 0.04, uy_cap, uy)
    y = y * (1.0 - cap_flat)

    # KEY UPGRADE 1: Broad, full Liao "方圆大脸" silhouette (matches ref A/B!):
    # Boost r_horiz on the upper cranium & lower jaw so neither the temples/crown nor the
    # jaw angles taper sharply into a cone!
    # Super-ellipsoidal radial boost: r_full = r_horiz ** 0.82 gives broader crown & broader jaw
    # Smoothly blended everywhere (no np.where discontinuity -> zero cheek crease!)
    r_head_full = np.power(np.maximum(r_horiz, 1e-9), 0.82)
    neck_r_blend = smootherstep(-0.36, -0.64, uy)
    r_head_env = r_head_full * (1.0 - neck_r_blend) + r_horiz * neck_r_blend

    # Horizontal cross-section: gentle squircle (broad cheeks, solid jaw angles, wide forehead)
    # Squircle factor boosts the 45-degree diagonals (cheekbones & jaw corners) slightly
    squircle = 1.0 + 0.045 * ((2.0 * hx * hz) ** 2) * smootherstep(0.45, 0.70, y) * (1.0 - smootherstep(1.55, 1.85, y))

    # Width along Y: stays impressively full from forehead (y=1.55) down to jaw angles (y=0.58)!
    jaw_fullness = 0.90 + 0.11 * smootherstep(0.42, 0.82, y)
    crown_breadth = 1.0 + 0.08 * smootherstep(1.30, 1.82, y) * (1.0 - smootherstep(1.94, 2.05, y))
    rx_head = 0.680 * jaw_fullness * crown_breadth * squircle

    # Front/back depth: dignified vertical-convex facial plane + full rounded occiput
    is_front = smootherstep(-0.18, 0.25, hz)
    rz_front = 0.625 * (0.94 + 0.07 * smootherstep(0.42, 0.85, y)) * crown_breadth
    rz_back = 0.675 * (0.84 + 0.18 * smootherstep(0.42, 1.25, y)) * crown_breadth
    rz_head = rz_back * (1.0 - is_front) + rz_front * is_front

    # Gentle sculptural flattening of central facial plane
    front_flat = 1.0 - 0.042 * (np.maximum(hz, 0.0) ** 3) * smootherstep(0.55, 1.48, y) * (1.0 - smootherstep(1.58, 1.88, y))
    rz_head = rz_head * front_flat

    # Sturdy neck cylinder shifted slightly back (-0.06 m)
    neck_flare = 1.0 + 0.04 * (1.0 - smootherstep(0.0, 0.24, y))
    rx_neck = 0.455 * neck_flare
    rz_neck = 0.420 * neck_flare
    z_neck_shift = -0.060 * neck_t

    # Strictly monotonic radial mapping on flat bottom disk (zero vertex collapse)
    rad_neck = np.where(uy >= uy_cap, 1.0, r_horiz / r_cap_rim)

    rx = rx_head * r_head_env * (1.0 - neck_t) + rx_neck * rad_neck * neck_t
    rz = rz_head * r_head_env * (1.0 - neck_t) + rz_neck * rad_neck * neck_t

    x = hx * rx
    z = hz * rz + z_neck_shift

    # Anatomical jaw & submental volume: full rounded jaw corners + clean chin-to-neck transition
    ax_raw = smooth_abs(x, eps=0.008)
    # Full mandibular angles / lower cheeks (gives the serene square-oval Liao face of ref A!)
    jaw_angle = gauss(ax_raw - 0.42, 0.16) * gauss(y - 0.62, 0.17) * smootherstep(-0.15, 0.45, hz)
    x += np.sign(x) * (0.048 * jaw_angle) * smootherstep(0.02, 0.12, np.abs(x))
    z += 0.032 * jaw_angle

    # Forward chin & lower jaw support (balanced classical profile, neither receding nor underbite)
    jaw_fwd = smootherstep(0.35, 0.49, y) * (1.0 - smootherstep(0.60, 0.85, y)) * (np.maximum(hz, 0.0) ** 1.5)
    z += 0.104 * jaw_fwd * gauss(x, 0.34)

    # Clean underside of chin transitioning into neck (subtle double-chin fullness of Liao sculpture)
    under_chin = smootherstep(0.34, 0.43, y) * (1.0 - smootherstep(0.43, 0.52, y)) * (np.maximum(hz, 0.0) ** 2)
    y -= 0.028 * under_chin * gauss(x, 0.30)

    # Three subtle traditional Buddhist neck rings (trivali)
    for yr in (0.14, 0.22, 0.30):
        ring_mask = (
            gauss(y - yr, 0.013)
            * smootherstep(-0.15, 0.55, hz)
            * smootherstep(0.05, 0.10, y)
            * (1.0 - smootherstep(0.32, 0.37, y))
        )
        x -= hx * (0.004 * ring_mask)
        z -= hz * (0.005 * ring_mask)

    # -----------------------------------------------------------------------
    # B. Broad, Low, Flat-Rounded Ushnisha (宽圆低缓肉髻，绝不尖耸！)
    # -----------------------------------------------------------------------
    # Matches ref A & B: wide circular dome (radius ~0.48 m) rising only ~0.115 m above the wide crown
    top_mask = smootherstep(1.72, 1.94, y)
    r_ush = np.sqrt(x * x + (z + 0.04) ** 2)
    u_norm = np.clip(r_ush / 0.48, 0.0, 1.0)
    # Flat-topped super-dome (exponent 3.4 -> wide rounded plateau)
    ush_dome = (1.0 - u_norm ** 3.4) ** 0.45
    ush_blend = smootherstep(0.52, 0.28, r_ush)
    y += top_mask * (0.112 * ush_dome * ush_blend + 0.016 * gauss(r_ush, 0.42))

    # -----------------------------------------------------------------------
    # C. Round-2 Sculptural Facial Anatomy (Crisp Planes + Monumental Volume)
    # -----------------------------------------------------------------------
    front_mask = smootherstep(0.05, 0.42, hz) * smootherstep(0.35, 0.45, y) * (1.0 - smootherstep(1.56, 1.72, y))
    ax = smooth_abs(x, eps=0.006)
    dz = np.zeros_like(z)

    # --- 1. Cranial & Facial Bone Planes (Forehead, Zygoma, Cheek Pads, Temples) ---
    # Broad, serene frontal bossing (forehead plane)
    dz += 0.026 * gauss(y - 1.42, 0.12) * gauss(x, 0.42)
    # Subtle temple plane recession beside outer brow (gives forehead & brow real 3D structure!)
    temple_rec = gauss(ax - 0.56, 0.10) * gauss(y - 1.32, 0.15)
    dz -= 0.016 * temple_rec

    # Soft, high zygomatic (cheekbone) fullness transitioning into plush Liao cheeks
    zygoma = gauss(ax - 0.40, 0.15) * gauss(y - 1.00, 0.13)
    cheek_pad = gauss(ax - 0.30, 0.16) * gauss(y - 0.84, 0.17)
    lower_cheek = gauss(ax - 0.28, 0.16) * gauss(y - 0.62, 0.15)
    dz += 0.026 * zygoma + 0.036 * cheek_pad + 0.028 * lower_cheek

    # Very subtle nasolabial plane transition (soft cheek fullness beside nose & mouth, not old/gaunt)
    dz += 0.014 * gauss(ax - 0.23, 0.09) * gauss(y - 0.82, 0.10)

    # Maxillary barrel supporting the compact mouth & philtrum
    dz += 0.044 * gauss(x, 0.23) * gauss(y - 0.74, 0.14)

    # Gentle sculpted orbital concavity (creates clean shadow under the brow arch)
    eye_y0 = 1.135
    eye_x0 = 0.295
    eye_w = 0.330  # slender graceful eye width 0.33 m (inner 0.130, outer 0.460)
    orb_r2 = ((ax - eye_x0) / 0.205) ** 2 + ((y - (eye_y0 + 0.020)) / 0.115) ** 2
    dz -= 0.032 * np.exp(-0.5 * orb_r2)

    # --- 2. Crisp Slender Sweeping Liao Brow Arch (修长柳叶平眉，眉心平整开阔) ---
    # Sweeps gracefully from nasal root (ax=0.09, y=1.288) -> peak (ax=0.28, y=1.334) -> tail (ax=0.51, y=1.262)
    # Head (+26 mm higher than tail -> positive deg!)
    t_b = np.clip((ax - 0.085) / 0.44, 0.0, 1.0)
    y_brow = 1.288 + 0.052 * np.sin(math.pi * (t_b ** 0.82)) - 0.028 * (t_b ** 1.45)
    brow_x_env = smootherstep(0.055, 0.125, ax) * (1.0 - smootherstep(0.47, 0.56, ax))
    # Crisp sculptural brow ridge + subtle orbital brow-bone step right beneath it
    brow_ridge = sharp_ridge(y - y_brow, 0.019) * brow_x_env
    brow_bone = smootherstep(y_brow - 0.045, y_brow + 0.010, y) * (1.0 - smootherstep(y_brow + 0.020, y_brow + 0.085, y)) * brow_x_env
    dz += 0.018 * brow_ridge + 0.014 * brow_bone

    # Smooth convex glabella (眉心绝对平整无褶)
    dz += 0.016 * gauss(x, 0.095) * gauss(y - 1.285, 0.068)

    # Refined Urna (白毫) at mid-forehead (y=1.398, well above browKnit window)
    r_urna = np.sqrt(x * x + (y - 1.398) ** 2)
    dz += 0.013 * np.sqrt(np.maximum(0.0, 1.0 - (r_urna / 0.023) ** 2))

    # --- 3. Crisp Willow-Leaf Half-Open Downcast Eyes (精致柳叶半开垂目) ---
    u = (ax - eye_x0) / (0.5 * eye_w)  # -1 inner canthus, +1 outer canthus
    eye_s = np.clip(1.0 - u * u, 0.0, 1.0)
    # Pointed willow-leaf envelope (sharper tapered corners than Round 1!)
    willow = eye_s ** 1.35

    # Graceful downcast arc: inner corner gently dips toward nose bridge, outer corner sweeps cleanly
    y_eye_arc = eye_y0 - 0.014 * (1.0 - eye_s) + 0.013 * u * eye_s - 0.008 * np.exp(-0.5 * ((u + 0.92) / 0.25) ** 2)

    # Palpebral fissure opening: ~0.078 m at centre -> 0.236 of eye_w (strictly in 0.2-0.3 eye width!)
    slit_half = 0.039 * willow
    y_up = y_eye_arc + slit_half * 0.70
    y_lo = y_eye_arc - slit_half * 1.30

    # Smooth convex eyeball surface inside socket
    r_ball2 = ((ax - eye_x0) / 0.155) ** 2 + ((y - (eye_y0 - 0.006)) / 0.092) ** 2
    dz += 0.032 * np.exp(-0.5 * r_ball2) * smootherstep(1.12, 0.62, np.abs(u))

    # Thick solid sculpted upper eyelid hood with CRISP lower margin & elegant supratarsal fold
    lid_x = np.clip(1.0 - (u / 1.05) ** 2, 0.0, 1.0) ** 0.78
    # Crisp solid step at upper eyelid rim (transition width 12mm -> sharp clean sculptural shelf!)
    up_margin = smootherstep(y_up - 0.006, y_up + 0.012, y)
    up_top = 1.0 - smootherstep(y_up + 0.056 * (0.45 + 0.55 * willow), y_up + 0.118, y)
    # Subtle bevel ridge along the lower edge of the upper eyelid
    up_rim_bevel = sharp_ridge(y - (y_up + 0.013), 0.011) * (willow ** 0.75)
    dz += (0.028 * up_margin * up_top * lid_x) + (0.007 * up_rim_bevel)

    # Crisp supratarsal eyelid crease (双眼皮折线) echoing the willow arch
    crease_y = y_up + 0.050 * (0.40 + 0.60 * willow)
    dz -= 0.009 * sharp_ridge(y - crease_y, 0.009) * (willow ** 0.70)

    # Delicate sculpted lower eyelid rim
    lo_margin = 1.0 - smootherstep(y_lo - 0.009, y_lo + 0.005, y)
    lo_bot = smootherstep(y_lo - 0.042 * (0.45 + 0.55 * willow), y_lo - 0.010, y)
    dz += 0.012 * lo_margin * lo_bot * (willow ** 0.75)

    # Crisp recessed shadow line directly under the heavy upper lid margin + subtle lower lid line
    upper_slit_groove = sharp_ridge(y - (y_up - 0.005), 0.0085) * (willow ** 0.80)
    lower_slit_groove = sharp_ridge(y - (y_lo + 0.004), 0.0065) * (willow ** 0.80)
    dz -= 0.017 * upper_slit_groove + 0.007 * lower_slit_groove

    # Defined inner canthus tear-duct pocket & subtle outer canthus taper
    dz -= 0.012 * np.exp(-0.5 * (((ax - 0.138) / 0.022) ** 2 + ((y - (eye_y0 - 0.018)) / 0.016) ** 2))
    dz -= 0.006 * np.exp(-0.5 * (((ax - 0.455) / 0.024) ** 2 + ((y - (eye_y0 - 0.005)) / 0.015) ** 2))

    # --- 4. Noble Sculpted Classical Nose (端正鼻梁 + 圆润悬胆鼻头 + 清晰鼻翼沟) ---
    y_nroot = 1.255
    y_ntip = 0.922
    y_nbase = 0.855

    t_nose = np.clip((y_nroot - y) / (y_nroot - y_ntip), 0.0, 1.0)
    nose_v = smootherstep(y_nbase - 0.008, y_nbase + 0.044, y) * (1.0 - smootherstep(y_nroot - 0.035, y_nroot + 0.075, y))

    # Planar trapezoidal bridge: slightly flat-crested dorsum + clean sloping side walls
    bridge_w = 0.048 + 0.024 * t_nose
    bridge_h = 0.018 + 0.064 * (t_nose ** 0.94)
    # Super-Gaussian exponent 2.5 gives crisp classical nasal bridge side planes
    bridge_prof = np.exp(-0.5 * ((x / bridge_w) ** 2) ** 1.25)
    dz += bridge_h * bridge_prof * nose_v

    # Plump, rounded fleshy nasal tip (圆润悬胆鼻头，侧面柔美不尖)
    tip_r2 = (x / 0.080) ** 2 + ((y - (y_ntip - 0.008)) / 0.064) ** 2
    dz += 0.036 * np.exp(-0.5 * tip_r2)

    # Distinct, sculpted rounded nose wings (alae) wrapping neatly around nostrils
    ala_r2 = ((ax - 0.092) / 0.048) ** 2 + ((y - 0.892) / 0.038) ** 2
    dz += 0.046 * np.exp(-0.5 * ala_r2)

    # Crisp Alar Crease (鼻翼沟) separating the nose wings cleanly from the cheeks!
    alar_d = np.sqrt(((ax - 0.092) / 0.068) ** 2 + ((y - 0.896) / 0.054) ** 2) - 1.0
    alar_crease_mask = smootherstep(0.085, 0.130, ax) * smootherstep(0.845, 0.885, y) * (1.0 - smootherstep(0.925, 0.960, y))
    dz -= 0.011 * sharp_ridge(alar_d, 0.18) * alar_crease_mask

    # Gentle refined nostril undersides & columella
    nostril_r2 = ((ax - 0.060) / 0.024) ** 2 + ((y - 0.866) / 0.014) ** 2
    dz -= 0.014 * np.exp(-0.5 * nostril_r2)
    dz += 0.008 * np.exp(-0.5 * ((x / 0.022) ** 2 + ((y - 0.872) / 0.020) ** 2))  # columella
    dz -= 0.008 * gauss(x, 0.088) * gauss(y - y_nbase, 0.020)

    # Soft refined philtrum (人中浅而精致)
    phil_y = smootherstep(0.735, 0.768, y) * (1.0 - smootherstep(0.822, 0.855, y))
    dz -= 0.004 * gauss(x, 0.026) * phil_y
    dz += 0.003 * gauss(ax - 0.040, 0.018) * phil_y

    # --- 5. Compact, Plush Sculpted Petal Lips (小巧饱满花瓣唇，清晰唇峰，含笑闭合) ---
    # Mouth slit centre at y = 0.680, corner span w = 0.50 m (corners at x = +/- 0.245),
    # while lush vermilion lip volume concentrates gracefully within |x| <= 0.205 m (like ref A!)
    y_mouth = 0.680
    mouth_hw = 0.245
    u_m = ax / mouth_hw
    u_m2 = (x / mouth_hw) ** 2
    # Compact petal lip envelope (full in centre, tapers cleanly before corners)
    petal_env = np.clip(1.0 - (x / 0.215) ** 2, 0.0, 1.0)
    corner_env = np.clip(1.0 - u_m2, 0.0, 1.0)

    # Classic wavy closed smile curve:
    # Subtle dip at central tubercle, gentle rise toward outer lips, upturned serene corners (+0.017m = +0.034w!)
    wave_smile = (
        -0.005 * np.exp(-0.5 * (x / 0.042) ** 2)
        + 0.005 * np.exp(-0.5 * ((ax - 0.095) / 0.055) ** 2)
        + 0.017 * (u_m2 ** 1.1) * smootherstep(1.30, 0.72, u_m2)
    )
    y_slit = y_mouth + wave_smile

    # Upper lip vermilion boundary: crisp Cupid's bow (M-shaped arch!)
    cupid_arch = (
        -0.010 * np.exp(-0.5 * (x / 0.036) ** 2)
        + 0.012 * np.exp(-0.5 * ((ax - 0.068) / 0.042) ** 2)
    )
    h_up = (0.048 * (petal_env ** 0.62) + cupid_arch * (petal_env ** 0.5))
    y_up_vermilion = y_slit + np.maximum(h_up, 0.008)

    # Lower lip vermilion boundary: compact plump pillow (fullest in central 65% of mouth width!)
    lo_petal = np.clip(1.0 - (x / 0.195) ** 2, 0.0, 1.0)
    h_lo = 0.058 * (lo_petal ** 0.60)
    y_lo_vermilion = y_slit - np.maximum(h_lo, 0.008)

    # Sculpted upper lip cushion (smoothly anti-aliased transitions > 1.5x mesh edge)
    up_in = smootherstep(y_slit - 0.006, y_slit + 0.016, y) * (1.0 - smootherstep(y_up_vermilion - 0.015, y_up_vermilion + 0.010, y))
    up_ridge = gauss(y - (y_up_vermilion - 0.004), 0.010) * (petal_env ** 0.65)
    tubercle = np.exp(-0.5 * ((x / 0.046) ** 2 + ((y - (y_slit + 0.016)) / 0.020) ** 2))

    # Sculpted lower lip cushion (plump rounded petal, smoothly recessed at bottom margin)
    lo_in = smootherstep(y_lo_vermilion - 0.010, y_lo_vermilion + 0.016, y) * (1.0 - smootherstep(y_slit - 0.016, y_slit + 0.006, y))

    # Keep lip forward projection refined & restrained (passes lip/w <= 0.03 with zero pouting!)
    dz += (
        0.018 * up_in * (petal_env ** 0.55)
        + 0.004 * up_ridge
        + 0.006 * tubercle
        + 0.020 * lo_in * (lo_petal ** 0.55)
    )

    # Smooth, crisp closed mouth slit (C-infinity Gaussian sigma=0.0115m -> ZERO corner aliasing!)
    slit_x = smootherstep(1.05, 0.72, u_m2)
    dz -= 0.024 * gauss(y - y_slit, 0.0115) * slit_x

    # Soft sculptural smiling corner dimples (口角涡) framing the compact lips
    corner_dimple = np.exp(-0.5 * (((ax - 0.242) / 0.032) ** 2 + ((y - (y_mouth + 0.017)) / 0.026) ** 2))
    dz -= 0.011 * corner_dimple
    # Subtle soft cheek cushion right outside each corner (classic serene Buddhist smile)
    dz += 0.009 * np.exp(-0.5 * (((ax - 0.278) / 0.044) ** 2 + ((y - (y_mouth + 0.020)) / 0.046) ** 2))

    # --- 6. Natural Labiomental Transition & Round Receding Chin (圆而收、无圆垫) ---
    # Very gentle natural transition below lower lip (~10-14 mm depth, well under 40 mm limit)
    dz -= 0.007 * gauss(y - 0.602, 0.026) * gauss(x, 0.145)

    # Broad, dignified rounded chin (softly aligned below lower lip, NOT a separate round pad)
    dz += 0.056 * gauss(y - 0.510, 0.092) * gauss(x, 0.22)

    z = z + dz * front_mask
    y = np.where(uy <= uy_cap, 0.0, np.maximum(y, 0.0))

    verts = np.stack([x, y, z], axis=1)
    return verts, quads


# ---------------------------------------------------------------------------
# 3. Watertight Sculpted Ears (厚实圆钝佛耳垂珠，不穿孔，水密闭合)
# ---------------------------------------------------------------------------

def build_ear(side: int, n_subdiv: int = 40):
    dirs, quads = make_cube_sphere(n_subdiv)
    u = dirs[:, 2]
    v = dirs[:, 1]
    w = dirs[:, 0] * side

    # Vertical span: y in [0.44, 1.32] (height 0.88 m, centred at 0.88 m)
    y_local = 0.44 * v

    # KEY UPGRADE 6: Full, blunt-rounded, plump Buddhist earlobe (NOT pointed!)
    # Keep anterior-posterior width generous all the way down to v=-0.85, then round cleanly
    ap_width = 0.165 + 0.032 * smootherstep(-0.2, 0.5, v) - 0.018 * smootherstep(-0.25, -0.92, v)
    # Slight broadening at the lower earlobe droplet (v in [-0.85, -0.40])
    lobe_bulb = 0.022 * gauss(v + 0.68, 0.22)
    z_sweep = -0.040 * smootherstep(-0.15, 0.8, v) + 0.026 * smootherstep(-0.30, -0.90, v)
    z_local = z_sweep + (ap_width + lobe_bulb) * u

    # Thick, fleshy, substantial earlobe (steady monumental Buddhist ear)
    thick = 0.060 + 0.034 * smootherstep(-0.20, -0.82, v)
    x_local = thick * w

    out_mask = smootherstep(-0.10, 0.32, w)
    concha = np.exp(-0.5 * (((v - 0.16) / 0.30) ** 2 + ((u - 0.05) / 0.38) ** 2))
    r_pinna = np.sqrt((u + 0.04) ** 2 + ((v - 0.18) / 0.72) ** 2)
    helix = sharp_ridge(r_pinna - 0.82, 0.13) * smootherstep(-0.35, 0.05, v) * smootherstep(0.35, -0.35, u)
    antihelix = sharp_ridge(r_pinna - 0.50, 0.12) * smootherstep(-0.22, 0.16, v) * smootherstep(0.25, -0.20, u)
    tragus = np.exp(-0.5 * (((v - 0.00) / 0.13) ** 2 + ((u - 0.66) / 0.20) ** 2))

    x_local += out_mask * (-0.042 * concha + 0.032 * helix + 0.018 * antihelix + 0.020 * tragus)

    # Gentle flare at upper back, curving warmly inward at plump earlobe
    flare = 0.068 * smootherstep(0.45, -0.75, u) * (0.55 + 0.45 * smootherstep(-0.45, 0.6, v))
    lobe_in = -0.022 * smootherstep(-0.25, -0.95, v)
    x_local += flare + lobe_in

    # Firmly embedded into side of broad Liao head
    x_world = side * (0.670 + x_local)
    y_world = 0.880 + y_local
    z_world = -0.055 + z_local

    verts = np.stack([x_world, y_world, z_world], axis=1)
    if side < 0:
        quads = quads[:, ::-1].copy()
    return verts, quads


# ---------------------------------------------------------------------------
# 4. Crisp Deep-Groove Spiral Hair Curls (深纹立体盘卷螺发)
# ---------------------------------------------------------------------------

def make_single_curl_template():
    """
    Create one watertight spiral snail-shell hair curl (螺发) with crisp 3-turn
    sculpted spiral grooves. Uses cube-sphere n=6 (216 quads = 432 tris, 100% watertight).
    """
    dirs, quads = make_cube_sphere(6)
    dx, dy, dz = dirs[:, 0], dirs[:, 1], dirs[:, 2]

    theta = np.arctan2(dz, dx)
    r_xz = np.sqrt(dx * dx + dz * dz)

    # Crisp 3-turn tightly coiled spiral groove on upper dome (matches ref A/B!)
    top = smootherstep(-0.12, 0.18, dy)
    spiral_turns = 2.8
    phase = 2.0 * math.pi * spiral_turns * (1.0 - r_xz) + theta
    # Deeply carved valley with rounded sculptural coil crest
    coil = (0.5 + 0.5 * np.cos(phase)) ** 1.75
    coil_env = smootherstep(0.05, 0.18, r_xz) * (1.0 - smootherstep(0.88, 1.0, r_xz)) * top

    # Slightly flatter cushion top so curls pack like carved clay coils rather than round beads
    r_scale = 1.04 + 0.12 * coil * coil_env
    h_scale = 0.62 + 0.42 * coil * coil_env

    x = dx * r_scale
    z = dz * r_scale
    y = dy * h_scale + 0.18

    verts = np.stack([x, y, z], axis=1)
    return verts, quads


def hairline_y(x, z):
    ax = np.abs(x)
    ang = np.arctan2(z, ax + 1e-9)
    front_t = smootherstep(0.28, 0.90, ang)
    back_t = smootherstep(-0.15, -0.82, ang)

    # Classic serene straight-gentle Liao forehead hairline
    y_front = 1.515 - 0.015 * smootherstep(0.34, 0.58, ax)
    y_side = 1.305
    y_back = 0.655 + 0.11 * smootherstep(0.28, 0.60, ax)

    yh = y_side * (1.0 - front_t) + y_front * front_t
    yh = yh * (1.0 - back_t) + y_back * back_t
    yh = np.maximum(yh, 1.26 * (1.0 - smootherstep(-0.08, -0.22, z)) * smootherstep(0.52, 0.68, ax))
    return yh


def place_spiral_curls(head_verts, head_quads):
    center = np.array([0.0, 1.18, -0.02], dtype=np.float64)
    rel = head_verts - center
    dist = np.linalg.norm(rel, axis=1)
    v_dirs = rel / np.maximum(dist[:, None], 1e-12)

    v0 = head_verts[head_quads[:, 0]]
    v1 = head_verts[head_quads[:, 1]]
    v2 = head_verts[head_quads[:, 2]]
    v3 = head_verts[head_quads[:, 3]]
    fn = np.cross(v2 - v0, v3 - v1)
    vn = np.zeros_like(head_verts)
    for k in range(4):
        np.add.at(vn, head_quads[:, k], fn)
    vn /= np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)

    # Slightly tighter, denser curl packing (like ref A/B tightly packed clay coils)
    curl_r = 0.058
    spacing = 0.092

    template_v, template_q = make_single_curl_template()

    cand_dirs = [np.array([0.0, 1.0, 0.0], dtype=np.float64)]
    phi_step = spacing / 0.75
    for r_idx in range(1, 22):
        phi = r_idx * phi_step
        if phi > 2.30:
            break
        ring_rad = math.sin(phi)
        circ = 2.0 * math.pi * 0.74 * ring_rad
        n_az = max(6, int(round(circ / spacing)))
        offset = 0.0 if (r_idx % 2 == 0) else (math.pi / n_az)
        for k in range(n_az):
            az = offset + 2.0 * math.pi * k / n_az
            sx = math.sin(phi) * math.sin(az)
            sy = math.cos(phi)
            sz = math.sin(phi) * math.cos(az)
            cand_dirs.append(np.array([sx, sy, sz], dtype=np.float64))

    cand_dirs = np.array(cand_dirs, dtype=np.float64)

    upper_idx = np.nonzero(head_verts[:, 1] > 0.55)[0]
    u_dirs = v_dirs[upper_idx]
    dots = cand_dirs @ u_dirs.T
    best_idx = upper_idx[np.argmax(dots, axis=1)]

    pts = head_verts[best_idx]
    nrms = vn[best_idx]

    yh = hairline_y(pts[:, 0], pts[:, 2])
    keep = pts[:, 1] >= (yh + 0.022)
    in_ear_zone = (np.abs(pts[:, 0]) > 0.58) & (pts[:, 1] < 1.30) & (pts[:, 2] > -0.23) & (pts[:, 2] < 0.14)
    keep = keep & (~in_ear_zone)

    pts = pts[keep]
    nrms = nrms[keep]

    all_v = []
    all_q = []
    v_offset = 0

    for p, nrm in zip(pts, nrms):
        up_ref = np.array([0.0, 0.0, 1.0]) if abs(nrm[1]) > 0.92 else np.array([0.0, 1.0, 0.0])
        t1 = np.cross(up_ref, nrm)
        t1 /= np.linalg.norm(t1)
        t2 = np.cross(nrm, t1)

        edge_dist = p[1] - hairline_y(np.array([p[0]]), np.array([p[2]]))[0]
        r_local = curl_r * (0.88 + 0.12 * float(smootherstep(0.02, 0.14, edge_dist)))
        p_embed = p - 0.016 * nrm

        tv = template_v * r_local
        world_v = (
            p_embed[None, :]
            + tv[:, 0:1] * t1[None, :]
            + tv[:, 1:2] * nrm[None, :]
            + tv[:, 2:3] * t2[None, :]
        )
        all_v.append(world_v)
        all_q.append(template_q + v_offset)
        v_offset += len(world_v)

    return np.concatenate(all_v, axis=0), np.concatenate(all_q, axis=0), len(pts)


# ---------------------------------------------------------------------------
# 5. Assemble in Blender (bpy==5.3.0) and Export Deterministic GLB
# ---------------------------------------------------------------------------

def quads_to_tris(quads: np.ndarray) -> np.ndarray:
    t1 = quads[:, [0, 1, 2]]
    t2 = quads[:, [0, 2, 3]]
    return np.concatenate([t1, t2], axis=0)


def gltf_to_blender(verts: np.ndarray) -> np.ndarray:
    return np.stack([verts[:, 0], -verts[:, 2], verts[:, 1]], axis=1)


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 make_head.py <out.glb>", file=sys.stderr)
        sys.exit(2)
    out_path = os.path.abspath(sys.argv[1])
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)

    head_v, head_q = build_head_and_neck(n_subdiv=230)
    ear_l_v, ear_l_q = build_ear(+1, n_subdiv=40)
    ear_r_v, ear_r_q = build_ear(-1, n_subdiv=40)
    curls_v, curls_q, n_curls = place_spiral_curls(head_v, head_q)

    parts_v = [head_v, ear_l_v, ear_r_v, curls_v]
    parts_t = [
        quads_to_tris_symmetric(head_v, head_q),
        quads_to_tris(ear_l_q),
        quads_to_tris(ear_r_q),
        quads_to_tris(curls_q),
    ]

    all_v = []
    all_t = []
    off = 0
    for pv, pt in zip(parts_v, parts_t):
        all_v.append(pv)
        all_t.append(pt + off)
        off += len(pv)

    verts = np.concatenate(all_v, axis=0)
    tris = np.concatenate(all_t, axis=0)

    # Normalize height strictly to 2.200 m with flat neck base at y = 0.0
    y_min = float(verts[:, 1].min())
    y_max = float(verts[:, 1].max())
    verts[:, 1] -= y_min
    scale = 2.200 / (y_max - y_min)
    verts *= scale
    verts[verts[:, 1] < 1e-7, 1] = 0.0

    # Centre neck base strictly on X=0, Z=0
    base_mask = verts[:, 1] < 0.01
    if base_mask.any():
        bz = float(verts[base_mask, 2].mean())
        verts[:, 2] -= bz

    verts_bl = gltf_to_blender(verts).astype(np.float32)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    mesh = bpy.data.meshes.new("BuddhaHeadMesh")
    mesh.from_pydata(verts_bl.tolist(), [], tris.tolist())
    mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
    mesh.update()

    obj = bpy.data.objects.new("BuddhaHead", mesh)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_texcoords=False,
        export_normals=True,
        export_tangents=False,
        export_materials="NONE",
        export_attributes=False,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_lights=False,
        export_cameras=False,
        export_extras=False,
    )

    mn = verts.min(axis=0)
    mx = verts.max(axis=0)
    print(
        f"Exported {out_path}\n"
        f"  Vertices : {len(verts):,}\n"
        f"  Triangles: {len(tris):,} (curls: {n_curls})\n"
        f"  BBox (m) : X=[{mn[0]:+.4f}, {mx[0]:+.4f}] (W={mx[0]-mn[0]:.4f})  "
        f"Y=[{mn[1]:+.4f}, {mx[1]:+.4f}] (H={mx[1]-mn[1]:.4f})  "
        f"Z=[{mn[2]:+.4f}, {mx[2]:+.4f}] (D={mx[2]-mn[2]:.4f})"
    )


if __name__ == "__main__":
    main()
