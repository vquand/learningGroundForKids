#!/usr/bin/env python3
"""Turn an agy/Imagen sprite sheet on a flat magenta (#FF00FF) background into a transparent PNG sheet.

Usage: python3 -I scripts/art/chroma_key_sheet.py INPUT.jpg OUTPUT.png [--frames 4] [--cell 256] [--margin 12] [--rows 1] [--row 0] [--target-area 0.30] [--only-frame N]

Steps: key out magenta with a soft alpha ramp, remove magenta spill on edge pixels, find the sprite
columns, scale ALL frames by one shared factor (so sizes stay consistent), bottom-align them on one
baseline and place each in a square cell. Needs Pillow and NumPy; never reads or writes the repo.
"""
import argparse
import sys

import numpy as np
from PIL import Image


def key_magenta(rgb: np.ndarray) -> np.ndarray:
    a = rgb.astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    distance = np.sqrt((r - 255) ** 2 + g ** 2 + (b - 255) ** 2)
    alpha = np.clip((distance - 70) / 90, 0, 1)
    # agy sometimes adds a soft ground shadow: darker magenta/purple. Sprite colors (browns, reds, oranges) never match it.
    alpha[(g < 80) & (r > 90) & (b > 100) & (np.abs(r - b) < 90)] = 0
    spill = np.maximum(np.minimum(r, b) - g, 0)
    edge = (alpha < 1) & (alpha > 0)
    out = a.copy()
    out[..., 0] = np.where(edge, np.clip(r - spill * 0.6, 0, 255), r)
    out[..., 2] = np.where(edge, np.clip(b - spill * 0.6, 0, 255), b)
    return np.dstack([out.clip(0, 255), alpha * 255]).astype("uint8")


def column_groups(alpha: np.ndarray, gap: int = 20):
    xs = np.where((alpha > 0.5).any(axis=0))[0]
    if not len(xs):
        sys.exit("No sprite pixels found; is the background really flat magenta?")
    groups, start, prev = [], xs[0], xs[0]
    for x in xs[1:]:
        if x - prev > gap:
            groups.append((start, prev))
            start = x
        prev = x
    groups.append((start, prev))
    return groups


def row_bands(alpha: np.ndarray, gap: int = 20):
    """Vertical bands of content; a sheet generated as two rows of frames yields two bands."""
    ys = np.where((alpha > 0.5).any(axis=1))[0]
    bands, start, prev = [], ys[0], ys[0]
    for y in ys[1:]:
        if y - prev > gap:
            bands.append((start, prev))
            start = y
        prev = y
    bands.append((start, prev))
    return bands


def valley_rows(alpha: np.ndarray, rows: int):
    """Fallback for sheets whose rows touch: split at the emptiest horizontal line near each equal-height boundary."""
    solid = (alpha > 0.5).sum(axis=1)
    ys = np.where(solid > 0)[0]
    top, bottom = int(ys.min()), int(ys.max())
    step = (bottom - top + 1) / rows
    cuts = [top]
    for index in range(1, rows):
        centre = round(top + step * index)
        window = range(max(cuts[-1] + 1, centre - round(step * 0.2)), min(bottom, centre + round(step * 0.2)) + 1)
        cuts.append(min(window, key=lambda y: (solid[y], abs(y - centre))))
    cuts.append(bottom + 1)
    bands = []
    for start, end in zip(cuts, cuts[1:]):
        inside = np.where(solid[start:end] > 0)[0]
        if not len(inside):
            sys.exit(f"Row between lines {start} and {end} is empty; check the sheet layout.")
        bands.append((start + int(inside.min()), start + int(inside.max())))
    return bands


def valley_groups(alpha: np.ndarray, frames: int):
    """Fallback when sprites touch or overlap in x: split at the emptiest column near each equal-width boundary."""
    solid = (alpha > 0.5).sum(axis=0)
    xs = np.where(solid > 0)[0]
    left, right = int(xs.min()), int(xs.max())
    step = (right - left + 1) / frames
    cuts = [left]
    for index in range(1, frames):
        centre = round(left + step * index)
        window = range(max(cuts[-1] + 1, centre - round(step * 0.2)), min(right, centre + round(step * 0.2)) + 1)
        cuts.append(min(window, key=lambda x: (solid[x], abs(x - centre))))
    cuts.append(right + 1)
    groups = []
    for start, end in zip(cuts, cuts[1:]):
        inside = np.where(solid[start:end] > 0)[0]
        if not len(inside):
            sys.exit(f"Frame between columns {start} and {end} is empty; check the sheet layout.")
        groups.append((start + int(inside.min()), start + int(inside.max())))
    return groups


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--frames", type=int, default=4)
    parser.add_argument("--cell", type=int, default=256)
    parser.add_argument("--margin", type=int, default=12)
    parser.add_argument("--target-area", type=float, default=0.0, help="match visual mass: opaque area as a fraction of the cell area (for example 0.30); 0 = just fit the cell")
    parser.add_argument("--only-frame", type=int, default=-1, help="write a single square cell with this frame only (for sculptures that have one facing)")
    parser.add_argument("--rows", type=int, default=1, help="number of rows of frames in the sheet when they touch (splits at the emptiest line)")
    parser.add_argument("--row", type=int, default=0, help="which row of frames to use when the sheet has several (0-based)")
    args = parser.parse_args()

    rgba = key_magenta(np.asarray(Image.open(args.input).convert("RGB")))
    alpha = rgba[..., 3] / 255
    bands = row_bands(alpha, gap=6)
    if len(bands) == 1 and args.rows > 1:
        bands = valley_rows(alpha, args.rows)
    if len(bands) > 1:
        if not 0 <= args.row < len(bands):
            sys.exit(f"Sheet has {len(bands)} rows; --row must be 0..{len(bands) - 1}")
        top_y, bottom_y = bands[args.row]
        print(f"note: {len(bands)} rows found, using row {args.row} (y {top_y}-{bottom_y})")
        rgba = rgba[top_y:bottom_y + 1]
        alpha = alpha[top_y:bottom_y + 1]
    groups = column_groups(alpha)
    if len(groups) != args.frames:
        groups = valley_groups(alpha, args.frames)
    rows = np.where((alpha > 0.5).any(axis=1))[0]
    top, bottom = int(rows.min()), int(rows.max())
    width = max(right - left + 1 for left, right in groups)
    height = bottom - top + 1
    inner = args.cell - 2 * args.margin
    scale = min(inner / width, inner / height)
    if args.target_area > 0:
        areas = [float((alpha[:, left:right + 1] > 0.5).sum()) for left, right in groups]
        mean_area = sum(areas) / len(areas)
        scale = min(scale, (args.target_area * args.cell * args.cell / mean_area) ** 0.5)
    if args.only_frame >= 0:
        groups = [groups[args.only_frame]]
        args.frames = 1
    sheet = Image.new("RGBA", (args.cell * args.frames, args.cell), (0, 0, 0, 0))
    for index, (left, right) in enumerate(groups):
        frame = Image.fromarray(rgba[top:bottom + 1, left:right + 1], "RGBA")
        size = (max(1, round(frame.width * scale)), max(1, round(frame.height * scale)))
        frame = frame.resize(size, Image.LANCZOS)
        x = index * args.cell + (args.cell - frame.width) // 2
        y = args.cell - args.margin - frame.height
        sheet.alpha_composite(frame, (x, y))
    sheet.save(args.output)
    print(f"{args.output}: {sheet.size[0]}x{sheet.size[1]}, frames={args.frames}, scale={scale:.3f}")


if __name__ == "__main__":
    main()
