#!/usr/bin/env python3
"""Photo prep for hero images. Global adjustments only: orient, rotate, crop, mild lighting.
Never edits the item or background (no retouching, removal, blur, fill or generative changes).
Usage: python3 prep_photo.py in.jpg out.jpg [--rotate DEG] [--crop auto|none] [--light auto|none] [--wb auto|none]
--rotate: 90/180/270 for sideways photos, or a small angle (e.g. -2.5) to straighten; positive = counter-clockwise."""
import argparse, json, math
import numpy as np
from PIL import Image, ImageOps

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("dst")
ap.add_argument("--rotate", type=float, default=0.0)
ap.add_argument("--crop", default="auto", choices=["auto", "none"])
ap.add_argument("--light", default="auto", choices=["auto", "none"])
ap.add_argument("--wb", default="auto", choices=["auto", "none"])
ap.add_argument("--aspect", default="4:3")
a = ap.parse_args()
report = {"steps": []}

im = ImageOps.exif_transpose(Image.open(a.src)).convert("RGB")
report["input"] = f"{im.width}x{im.height}"

# 1. Rotate
if a.rotate:
    if abs(a.rotate) % 90 == 0:
        im = im.rotate(a.rotate, expand=True, resample=Image.BICUBIC)
    else:
        w, h = im.size
        im = im.rotate(a.rotate, expand=True, resample=Image.BICUBIC, fillcolor=(0, 0, 0))
        # crop to the largest axis-aligned rectangle inside the rotated original (removes empty corners)
        ang = math.radians(abs(a.rotate)); W2, H2 = im.size
        if w >= h: lw, sw = w, h
        else: lw, sw = h, w
        sin_a, cos_a = abs(math.sin(ang)), abs(math.cos(ang))
        if sw <= 2 * sin_a * cos_a * lw:
            x = 0.5 * sw; wr, hr = (x / sin_a, x / cos_a) if w >= h else (x / cos_a, x / sin_a)
        else:
            cos2 = cos_a * cos_a - sin_a * sin_a
            wr, hr = (w * cos_a - h * sin_a) / cos2, (h * cos_a - w * sin_a) / cos2
        l, t = (W2 - wr) / 2, (H2 - hr) / 2
        im = im.crop((int(l) + 1, int(t) + 1, int(l + wr) - 1, int(t + hr) - 1))
    report["steps"].append(f"rotated {a.rotate} deg")

# 2. Crop to aspect; re-center on the item only when it is clearly small within the frame
aw, ah = map(float, a.aspect.split(":")); target = aw / ah
arr = np.asarray(im).astype(np.float32)
if a.crop == "auto":
    H, W = arr.shape[:2]
    b = max(4, int(min(H, W) * 0.04))
    border = np.concatenate([arr[:b].reshape(-1, 3), arr[-b:].reshape(-1, 3), arr[:, :b].reshape(-1, 3), arr[:, -b:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    mask = np.abs(arr - bg).max(axis=2) > 38
    ys, xs = np.where(mask)
    cx, cy = W / 2, H / 2
    if len(xs) > W * H * 0.02:
        x0, x1 = np.percentile(xs, [0.5, 99.5]); y0, y1 = np.percentile(ys, [0.5, 99.5])
        if (x1 - x0) < 0.7 * W and (y1 - y0) < 0.7 * H:  # item is small in frame: center on it
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    cw = min(W, H * target); chh = cw / target
    left = min(max(cx - cw / 2, 0), W - cw); top = min(max(cy - chh / 2, 0), H - chh)
    box = (int(round(left)), int(round(top)), int(round(left + cw)), int(round(top + chh)))
    if box != (0, 0, W, H):
        im = im.crop(box); arr = np.asarray(im).astype(np.float32)
        report["steps"].append(f"cropped to {a.aspect}: {im.width}x{im.height}")

# 3. Lighting (global only, conservative; product color fidelity matters to buyers)
if a.light == "auto":
    x = arr / 255.0
    H, W = x.shape[:2]
    lum = 0.2126 * x[..., 0] + 0.7152 * x[..., 1] + 0.0722 * x[..., 2]
    lo, med, hi = np.percentile(lum, [1, 50, 99])
    # white balance only from a near-neutral background (border); skipped if the background is colored
    gains = (1.0, 1.0, 1.0)
    if a.wb == "auto":
        b = max(4, int(min(H, W) * 0.04))
        border = np.concatenate([x[:b].reshape(-1, 3), x[-b:].reshape(-1, 3), x[:, :b].reshape(-1, 3), x[:, -b:].reshape(-1, 3)])
        bgc = np.median(border, axis=0)
        sat = (bgc.max() - bgc.min()) / max(bgc.max(), 1e-3)
        if bgc.mean() > 0.55 and sat < 0.12:
            g = bgc.mean() / np.maximum(bgc, 1e-3)
            gains = tuple(float(np.clip(v, 0.95, 1.05)) for v in g)
            x = np.clip(x * np.array(gains), 0, 1)
    # levels: lift dark photos / recover flat contrast, capped (never darkens)
    lum = 0.2126 * x[..., 0] + 0.7152 * x[..., 1] + 0.0722 * x[..., 2]
    lo, med, hi = np.percentile(lum, [1, 50, 99])
    scale = float(np.clip(0.97 / max(hi, 0.3), 1.0, 1.6))
    black = float(min(lo, 0.05)) if lo > 0.0 else 0.0
    y = np.clip((x - black) * scale, 0, 1)
    m = float(np.median(0.2126 * y[..., 0] + 0.7152 * y[..., 1] + 0.0722 * y[..., 2]))
    gamma = float(np.clip(math.log(0.5) / math.log(m), 0.75, 1.0)) if 0.02 < m < 0.40 else 1.0
    y = np.power(y, gamma)
    arr = y * 255.0
    report["steps"].append(f"lighting: brightness x{scale:.2f}, gamma {gamma:.2f}, background white-balance gains {tuple(round(v, 3) for v in gains)}")

out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
out.save(a.dst, quality=95, subsampling=0)
report["output"] = f"{out.width}x{out.height}"
print(json.dumps(report, indent=2))
