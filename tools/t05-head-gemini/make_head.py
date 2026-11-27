#!/usr/bin/env python3
"""
Deterministic procedural high-poly Buddha head generator for T05 (issue #720).
Runs headless under Blender 5.3 Python module (bpy==5.3.0) with no network access.

Usage:
    python3 make_head.py <out.glb>

Coordinate system in exported glTF 2.0 (.glb):
    - Units: metres
    - Y up, face toward +Z, symmetry plane X = 0
    - Origin (0, 0, 0) at the centre of the flat neck base
    - Height (origin to top of ushnisha): 2.20 m
    - Mouth width: ~0.50 m, brow-to-mouth: ~0.60 m
    - Width-to-height ratio: ~0.72 (total) / ~0.76 (cranium) within [0.71, 0.83]
    - Neck stub: ~0.35 m below jaw, flat closed bottom
    - Pure geometry only (no textures, UVs, vertex colours, or rig)
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
    """C-infinity smooth approximation of |x| so derivative at x=0 is strictly 0."""
    return np.sqrt(x * x + eps * eps) - eps


# ---------------------------------------------------------------------------
# 1. Quad-sphere topology (watertight, zero poles, exact manifold quads)
# ---------------------------------------------------------------------------

def make_cube_sphere(n: int):
    """
    Create a subdivided cube projected onto the unit sphere.
    Each of the 6 faces has n x n quads -> 6 * n * n quads (12 * n * n tris).
    Vertices are welded deterministically across cube edges using integer grid keys.
    """
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
    """
    Mirror-symmetric quad-to-triangle split across X = 0!
    For quads on the +X side (centroid x >= 0): split along diagonal (0, 2) -> [0,1,2], [0,2,3].
    For quads on the -X side (centroid x <  0): split along diagonal (1, 3) -> [0,1,3], [1,2,3].
    Preserves exact outward winding while guaranteeing exact bilateral triangle & normal symmetry.
    """
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
# 2. Buddha Head & Neck Base + Liao Sculptural Facial Anatomy
# ---------------------------------------------------------------------------

def build_head_and_neck(n_subdiv: int = 220):
    """
    Build the continuous watertight head + neck mesh in glTF coordinates:
      Y up, +Z front, X=0 symmetry, flat sealed neck base at Y=0.0.
    """
    dirs, quads = make_cube_sphere(n_subdiv)

    # Smooth monotonic spherical warp concentrating vertices slightly toward +Z face
    ux, uy, uz = dirs[:, 0], dirs[:, 1], dirs[:, 2]
    front_pull = 0.24
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
    # A. Macro Silhouette: Broad Serene Liao Cranium + Sturdy Neck Stub
    # -----------------------------------------------------------------------
    uy_cap = -0.84
    r_cap_rim = math.sqrt(1.0 - uy_cap * uy_cap)

    # Cranium spans [0.36, 1.98]; neck stub spans [0.00, 0.44]
    y_cranium = 1.17 + 0.81 * uy
    neck_t = smootherstep(-0.46, -0.78, uy)
    y_neck = np.clip((uy - uy_cap) / (-0.42 - uy_cap), 0.0, 1.0) * 0.48
    y = y_cranium * (1.0 - neck_t) + y_neck * neck_t
    cap_flat = smootherstep(uy_cap + 0.04, uy_cap, uy)
    y = y * (1.0 - cap_flat)

    # Broad, full, rounded Liao cranium (matches ref A/B):
    # Extra fullness at upper cranium (y=1.3..1.85) so head is wide and dome-like, NOT conical!
    crown_full = 1.0 + 0.22 * smootherstep(1.15, 1.72, y) * (1.0 - smootherstep(1.88, 2.04, y))
    jaw_shape = 0.86 + 0.16 * smootherstep(0.38, 0.90, y)
    rx_head = 0.680 * jaw_shape * crown_full

    # Front/back depth: dignified vertical-convex facial plane so mouth & chin sit proudly
    is_front = smootherstep(-0.18, 0.25, hz)
    lower_face_support = 0.97 + 0.05 * smootherstep(0.42, 0.82, y)
    rz_front = 0.640 * lower_face_support * crown_full
    rz_back = 0.685 * (0.82 + 0.20 * smootherstep(0.42, 1.25, y)) * crown_full
    rz_head = rz_back * (1.0 - is_front) + rz_front * is_front

    # Gentle sculptural flattening of central facial plane
    front_flat = 1.0 - 0.030 * (np.maximum(hz, 0.0) ** 3) * smootherstep(0.55, 1.45, y) * (1.0 - smootherstep(1.55, 1.85, y))
    rz_head = rz_head * front_flat

    # Neck cross-section (sturdy cylinder shifted slightly back)
    neck_flare = 1.0 + 0.04 * (1.0 - smootherstep(0.0, 0.25, y))
    rx_neck = 0.435 * neck_flare
    rz_neck = 0.405 * neck_flare
    z_neck_shift = -0.065 * neck_t

    # Strictly monotonic radial factor on neck wall and flat bottom disk (zero collapsed vertices!)
    rad_neck = np.where(uy >= uy_cap, 1.0, r_horiz / r_cap_rim)
    rad_head = r_horiz

    rx = rx_head * rad_head * (1.0 - neck_t) + rx_neck * rad_neck * neck_t
    rz = rz_head * rad_head * (1.0 - neck_t) + rz_neck * rad_neck * neck_t

    x = hx * rx
    z = hz * rz + z_neck_shift

    # Forward jawline & chin structural support (balanced classical side profile:
    # neither receding nor underbite, keeping chin gently rounded & aligned beneath lips)
    jaw_fwd = smootherstep(0.33, 0.48, y) * (1.0 - smootherstep(0.62, 0.88, y)) * (np.maximum(hz, 0.0) ** 1.45)
    z += 0.148 * jaw_fwd * gauss(x, 0.35)

    # Clean, gentle underside of chin transitioning into front of neck
    under_chin = smootherstep(0.32, 0.41, y) * (1.0 - smootherstep(0.41, 0.50, y)) * (np.maximum(hz, 0.0) ** 2)
    y -= 0.025 * under_chin * gauss(x, 0.28)

    # Three subtle traditional Buddhist neck rings (trivali) on front of neck
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
    # B. Broad, Rounded Ushnisha (肉髻) — Classic Low Wide Dome
    # -----------------------------------------------------------------------
    # Broad circular dome (~0.45m radius) rising cleanly ~0.145m above the wide rounded cranium
    top_mask = smootherstep(1.66, 1.90, y)
    r_ush = np.sqrt(x * x + (z + 0.04) ** 2)
    u_norm = np.clip(r_ush / 0.44, 0.0, 1.0)
    ush_dome = (1.0 - u_norm ** 2.8) ** 0.50
    ush_blend = smootherstep(0.48, 0.24, r_ush)
    y += top_mask * (0.140 * ush_dome * ush_blend + 0.024 * gauss(r_ush, 0.38))

    # -----------------------------------------------------------------------
    # C. Serene Liao Facial Anatomy (Strict C2 smooth across X=0)
    # -----------------------------------------------------------------------
    front_mask = smootherstep(0.05, 0.45, hz) * smootherstep(0.34, 0.44, y) * (1.0 - smootherstep(1.56, 1.72, y))
    ax = smooth_abs(x, eps=0.008)

    dz = np.zeros_like(z)

    # --- 1. Forehead, Temples & Soft Full Cheeks ---
    dz += 0.020 * gauss(y - 1.40, 0.13) * gauss(x, 0.42)
    dz += 0.038 * gauss(ax - 0.33, 0.18) * gauss(y - 0.90, 0.22)
    dz += 0.030 * gauss(ax - 0.28, 0.18) * gauss(y - 0.64, 0.17)

    # Gentle oral/maxillary plane behind upper lip & philtrum so side profile flows smoothly
    dz += 0.052 * gauss(x, 0.24) * gauss(y - 0.75, 0.14)

    # Soft, serene orbital recess
    eye_y0 = 1.135
    eye_x0 = 0.300
    eye_w = 0.320  # single eye width 0.32 m (inner 0.140, outer 0.460)
    orb_r2 = ((ax - eye_x0) / 0.21) ** 2 + ((y - (eye_y0 + 0.015)) / 0.12) ** 2
    dz -= 0.024 * np.exp(-0.5 * orb_r2)

    # --- 2. Long Graceful Level Brow Arch (平眉：眉头高于眉梢，眉心平整开阔) ---
    t_b = np.clip((ax - 0.09) / 0.43, 0.0, 1.0)
    y_brow = 1.290 + 0.048 * np.sin(math.pi * (t_b ** 0.85)) - 0.030 * (t_b ** 1.5)
    brow_x_env = smootherstep(0.06, 0.14, ax) * (1.0 - smootherstep(0.47, 0.57, ax))
    dz += 0.022 * gauss(y - y_brow, 0.024) * brow_x_env

    # Glabella (眉心): smoothly convex, zero vertical frown crease!
    dz += 0.014 * gauss(x, 0.10) * gauss(y - 1.285, 0.07)

    # Refined Urna (白毫) at mid-forehead (y=1.395, above browKnit window)
    r_urna = np.sqrt(x * x + (y - 1.395) ** 2)
    dz += 0.011 * np.sqrt(np.maximum(0.0, 1.0 - (r_urna / 0.024) ** 2))

    # --- 3. Almond/Willow-Leaf Half-Open Downcast Eyes (半开垂目) ---
    u = (ax - eye_x0) / (0.5 * eye_w)
    eye_s = np.clip(1.0 - u * u, 0.0, 1.0)
    almond = eye_s ** 1.15

    y_eye_arc = eye_y0 - 0.012 * (1.0 - eye_s) + 0.010 * u * eye_s
    # Palpebral fissure opening: ~0.074 m at centre -> 0.231 of eye_w (strictly in 0.2-0.3 eye width!)
    slit_half = 0.037 * almond
    y_up = y_eye_arc + slit_half * 0.72
    y_lo = y_eye_arc - slit_half * 1.28

    # Smooth convex eyeball curvature
    r_ball2 = ((ax - eye_x0) / 0.155) ** 2 + ((y - (eye_y0 - 0.005)) / 0.095) ** 2
    dz += 0.028 * np.exp(-0.5 * r_ball2) * smootherstep(1.15, 0.65, np.abs(u))

    # Thick solid fleshy upper eyelid hood (zero thin flap, zero boxy edge)
    lid_x_fade = np.clip(1.0 - (u / 1.08) ** 2, 0.0, 1.0) ** 0.85
    up_step = smootherstep(y_up - 0.009, y_up + 0.018, y)
    up_top = 1.0 - smootherstep(y_up + 0.065 * (0.5 + 0.5 * almond), y_up + 0.125, y)
    dz += 0.026 * up_step * up_top * lid_x_fade

    # Subtle supratarsal eyelid fold
    crease_y = y_up + 0.052 * (0.45 + 0.55 * almond)
    dz -= 0.006 * gauss(y - crease_y, 0.011) * (almond ** 0.7)

    # Soft lower eyelid roll
    lo_step = 1.0 - smootherstep(y_lo - 0.010, y_lo + 0.007, y)
    lo_bot = smootherstep(y_lo - 0.048 * (0.5 + 0.5 * almond), y_lo - 0.012, y)
    dz += 0.010 * lo_step * lo_bot * (almond ** 0.75)

    # Clear downcast eye-slit shadow channel right under upper lid margin
    upper_slit_shadow = gauss(y - (y_up - 0.006), 0.009) * (almond ** 0.85)
    lower_slit_shadow = gauss(y - (y_lo + 0.005), 0.007) * (almond ** 0.85)
    dz -= 0.014 * upper_slit_shadow + 0.006 * lower_slit_shadow

    # Soft inner canthus recess
    dz -= 0.008 * np.exp(-0.5 * (((ax - 0.145) / 0.026) ** 2 + ((y - (eye_y0 - 0.012)) / 0.020) ** 2))

    # --- 4. Noble, Rounded Classical Nose (端正悬胆鼻头，柔和不尖锐) ---
    y_nroot = 1.245
    y_ntip = 0.928
    y_nbase = 0.855

    t_nose = np.clip((y_nroot - y) / (y_nroot - y_ntip), 0.0, 1.0)
    nose_v = smootherstep(y_nbase - 0.010, y_nbase + 0.048, y) * (1.0 - smootherstep(y_nroot - 0.04, y_nroot + 0.075, y))
    bridge_w = 0.056 + 0.024 * t_nose
    # Restrained classical bridge projection (~0.062 m) + plump rounded tip (~0.032 m)
    bridge_h = 0.016 + 0.058 * (t_nose ** 0.92)
    bridge_prof = np.exp(-0.5 * (x / bridge_w) ** 2)
    dz += bridge_h * bridge_prof * nose_v

    # Plump, rounded fleshy nasal tip (larger vertical radius -> soft rounded nose tip in profile!)
    tip_r2 = (x / 0.088) ** 2 + ((y - (y_ntip - 0.008)) / 0.066) ** 2
    dz += 0.032 * np.exp(-0.5 * tip_r2)

    # Rounded nasal wings (alae)
    ala_r2 = ((ax - 0.094) / 0.056) ** 2 + ((y - 0.896) / 0.044) ** 2
    dz += 0.044 * np.exp(-0.5 * ala_r2)

    # Subtle nostril recesses
    nostril_r2 = ((ax - 0.064) / 0.026) ** 2 + ((y - 0.870) / 0.015) ** 2
    dz -= 0.013 * np.exp(-0.5 * nostril_r2)

    # Soft nasal base junction
    dz -= 0.008 * gauss(x, 0.095) * gauss(y - y_nbase, 0.024)

    # Ultra-soft shallow philtrum (zero harsh midline shadow)
    phil_y = smootherstep(0.735, 0.775, y) * (1.0 - smootherstep(0.825, 0.860, y))
    dz -= 0.0025 * gauss(x, 0.036) * phil_y
    dz += 0.0020 * gauss(ax - 0.048, 0.026) * phil_y

    # --- 5. Refined Closed Petal Lips (小巧闭合、嘴角微上收、不撅嘴、无锯齿) ---
    # Mouth slit centre at y = 0.680, width w = 0.50 m (corners at x = +/- 0.250)
    y_mouth = 0.680
    mouth_hw = 0.250
    u_m2 = (x / mouth_hw) ** 2
    m_env = np.clip(1.0 - u_m2, 0.0, 1.0)

    # Serene upturned smile line: +0.016 m (+0.032 w) at corners (strictly in [0, 0.06] w!)
    y_slit = y_mouth + 0.016 * u_m2 * smootherstep(1.35, 0.78, u_m2)

    # Soft Cupid's bow (purely even in x^2)
    cupid = 0.005 * np.exp(-0.5 * (x / 0.048) ** 2) - 0.006 * np.exp(-0.5 * ((ax - 0.078) / 0.048) ** 2)
    h_up = 0.048 * (m_env ** 0.75) - cupid * m_env
    h_lo = 0.054 * (m_env ** 0.75)

    # Modest, refined lip projection (keeps lip/w <= 0.02, zero pouting!)
    up_lip = np.exp(-0.5 * ((y - (y_slit + 0.48 * h_up)) / np.maximum(0.48 * h_up, 0.013)) ** 2) * (m_env ** 0.65)
    tubercle = np.exp(-0.5 * ((x / 0.056) ** 2 + ((y - (y_slit + 0.022)) / 0.022) ** 2))
    lo_lip = np.exp(-0.5 * ((y - (y_slit - 0.48 * h_lo)) / np.maximum(0.48 * h_lo, 0.013)) ** 2) * (m_env ** 0.70)

    dz += 0.015 * up_lip + 0.004 * tubercle + 0.014 * lo_lip

    # Clean, smooth closed mouth slit (deep enough to be the unique local z-minimum
    # within +/-6cm so face-measure.py locks onto the true slit centre, zero aliasing!)
    slit_x = smootherstep(1.06, 0.74, u_m2)
    dz -= 0.032 * gauss(y - y_slit, 0.0115) * slit_x

    # Soft smiling corner dimples
    corner_dimple = np.exp(-0.5 * (((ax - 0.252) / 0.034) ** 2 + ((y - (y_mouth + 0.016)) / 0.028) ** 2))
    dz -= 0.012 * corner_dimple

    # --- 6. Smooth Rounded Chin (圆而收、不前突不后缩、极浅颏唇过渡、无圆垫) ---
    # Very gentle labiomental transition (depth ~8-12 mm, far below 40 mm limit)
    dz -= 0.002 * gauss(y - 0.605, 0.026) * gauss(x, 0.17)

    # Broad, serene rounded chin supporting the noseBase-chinFront profile line cleanly
    dz += 0.062 * gauss(y - 0.525, 0.105) * gauss(x, 0.23)

    z = z + dz * front_mask
    y = np.where(uy <= uy_cap, 0.0, np.maximum(y, 0.0))

    verts = np.stack([x, y, z], axis=1)
    return verts, quads


# ---------------------------------------------------------------------------
# 3. Watertight Sculpted Ears (丰厚长耳垂，不穿孔，水密闭合)
# ---------------------------------------------------------------------------

def build_ear(side: int, n_subdiv: int = 36):
    dirs, quads = make_cube_sphere(n_subdiv)
    u = dirs[:, 2]
    v = dirs[:, 1]
    w = dirs[:, 0] * side

    y_local = 0.44 * v
    ap_width = 0.165 + 0.035 * smootherstep(-0.2, 0.5, v) - 0.035 * smootherstep(-0.1, -0.85, v)
    z_sweep = -0.045 * smootherstep(-0.2, 0.8, v) + 0.028 * smootherstep(-0.3, -0.9, v)
    z_local = z_sweep + ap_width * u

    thick = 0.058 + 0.026 * smootherstep(-0.25, -0.85, v)
    x_local = thick * w

    out_mask = smootherstep(-0.1, 0.35, w)
    concha = np.exp(-0.5 * (((v - 0.16) / 0.33) ** 2 + ((u - 0.04) / 0.40) ** 2))
    r_pinna = np.sqrt((u + 0.04) ** 2 + ((v - 0.18) / 0.72) ** 2)
    helix = gauss(r_pinna - 0.82, 0.14) * smootherstep(-0.35, 0.05, v) * smootherstep(0.35, -0.35, u)
    antihelix = gauss(r_pinna - 0.50, 0.13) * smootherstep(-0.25, 0.15, v) * smootherstep(0.25, -0.20, u)
    tragus = np.exp(-0.5 * (((v - 0.02) / 0.14) ** 2 + ((u - 0.65) / 0.22) ** 2))

    x_local += out_mask * (-0.040 * concha + 0.028 * helix + 0.016 * antihelix + 0.018 * tragus)

    flare = 0.072 * smootherstep(0.45, -0.75, u) * (0.55 + 0.45 * smootherstep(-0.5, 0.6, v))
    lobe_curve = -0.018 * smootherstep(-0.25, -0.95, v)
    x_local += flare + lobe_curve

    x_world = side * (0.655 + x_local)
    y_world = 0.870 + y_local
    z_world = -0.055 + z_local

    verts = np.stack([x_world, y_world, z_world], axis=1)
    if side < 0:
        quads = quads[:, ::-1].copy()
    return verts, quads


# ---------------------------------------------------------------------------
# 4. Watertight Sculpted Spiral Hair Curls (立体螺发)
# ---------------------------------------------------------------------------

def make_single_curl_template():
    dirs, quads = make_cube_sphere(5)
    dx, dy, dz = dirs[:, 0], dirs[:, 1], dirs[:, 2]

    theta = np.arctan2(dz, dx)
    r_xz = np.sqrt(dx * dx + dz * dz)

    top = smootherstep(-0.10, 0.22, dy)
    spiral_turns = 2.5
    phase = 2.0 * math.pi * spiral_turns * (1.0 - r_xz) + theta
    ridge = (0.5 + 0.5 * np.cos(phase)) ** 1.35
    ridge_env = smootherstep(0.06, 0.22, r_xz) * (1.0 - smootherstep(0.86, 1.0, r_xz)) * top

    r_scale = 1.0 + 0.11 * ridge * ridge_env
    h_scale = 0.72 + 0.32 * ridge * ridge_env

    x = dx * r_scale
    z = dz * r_scale
    y = dy * h_scale + 0.20

    verts = np.stack([x, y, z], axis=1)
    return verts, quads


def hairline_y(x, z):
    ax = np.abs(x)
    ang = np.arctan2(z, ax + 1e-9)
    front_t = smootherstep(0.28, 0.92, ang)
    back_t = smootherstep(-0.15, -0.82, ang)

    y_front = 1.505 - 0.018 * smootherstep(0.32, 0.56, ax)
    y_side = 1.295
    y_back = 0.650 + 0.11 * smootherstep(0.26, 0.58, ax)

    yh = y_side * (1.0 - front_t) + y_front * front_t
    yh = yh * (1.0 - back_t) + y_back * back_t
    yh = np.maximum(yh, 1.25 * (1.0 - smootherstep(-0.08, -0.22, z)) * smootherstep(0.50, 0.65, ax))
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

    curl_r = 0.062
    spacing = 0.100

    template_v, template_q = make_single_curl_template()

    cand_dirs = [np.array([0.0, 1.0, 0.0], dtype=np.float64)]
    phi_step = spacing / 0.74
    for r_idx in range(1, 20):
        phi = r_idx * phi_step
        if phi > 2.30:
            break
        ring_rad = math.sin(phi)
        circ = 2.0 * math.pi * 0.73 * ring_rad
        n_az = max(6, int(round(circ / spacing)))
        offset = 0.0 if (r_idx % 2 == 0) else (math.pi / n_az)
        for k in range(n_az):
            az = offset + 2.0 * math.pi * k / n_az
            sx = math.sin(phi) * math.sin(az)
            sy = math.cos(phi)
            sz = math.sin(phi) * math.cos(az)
            cand_dirs.append(np.array([sx, sy, sz], dtype=np.float64))

    cand_dirs = np.array(cand_dirs, dtype=np.float64)

    # Subsample scalp vertices (stride 2) for fast exact nearest-direction lookup
    upper_idx = np.nonzero(head_verts[:, 1] > 0.55)[0]
    u_dirs = v_dirs[upper_idx]
    dots = cand_dirs @ u_dirs.T
    best_idx = upper_idx[np.argmax(dots, axis=1)]

    pts = head_verts[best_idx]
    nrms = vn[best_idx]

    yh = hairline_y(pts[:, 0], pts[:, 2])
    keep = pts[:, 1] >= (yh + 0.025)
    in_ear_zone = (np.abs(pts[:, 0]) > 0.56) & (pts[:, 1] < 1.29) & (pts[:, 2] > -0.23) & (pts[:, 2] < 0.14)
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
        r_local = curl_r * (0.88 + 0.12 * float(smootherstep(0.02, 0.15, edge_dist)))
        p_embed = p - 0.015 * nrm

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

    head_v, head_q = build_head_and_neck(n_subdiv=220)
    ear_l_v, ear_l_q = build_ear(+1, n_subdiv=36)
    ear_r_v, ear_r_q = build_ear(-1, n_subdiv=36)
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

    # Normalize height strictly to 2.200 m with neck base at y = 0.0
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
