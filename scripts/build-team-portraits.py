"""
Normalise the studio headshots into one consistent set of web portraits.

Framing is PROPORTIONAL, not a fixed pixel box. The shots were taken at different distances and
resolutions, so a shared 800x1000 crop measured in source pixels cut the MandiPlus wordmark off
nine of the twelve chests. Every crop is now derived from two landmarks measured per photo:

    hair top  -> pinned at HAIR_AT of the frame height
    logo foot -> pinned at LOGO_AT of the frame height

Anchoring on hair->logo rather than hair->shoulder is deliberate: the shoulder detector is
fooled by long hair (jaya) and by a dark background (bharath's composite), while both of these
landmarks measure cleanly on every shot. It also happens to normalise head size for free —
(logo - hair) tracks head span at a near-constant 1.52x across the whole set, so heads land
within a couple of percent of each other.

Two corrections run before the crop:
  * canvas extension — top for the tight frames, bottom for the two whose chest runs past the
    frame edge. Both regions are near-flat (studio sweep above, black tee below), so the ramp is
    continued with a damped slope plus matched grain and the seam is invisible.
  * background match — the plates run 172..228 in luminance and drift cool, so a feathered
    background mask pulls every sweep to one warm target.

Usage:  python3 build-team-portraits.py <out_dir>
"""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SRC = "/Users/omi/mandi/hotshots"

# Landmarks measured off each source: (source file, hair-top row, subject centre x, logo-foot row).
# Bharath's source is the grey-plate composite, not the raw candid — the original was shot against
# a dark wooden interior and has to be matted onto the studio plate before anything else works.
GEOM = {
    "bharath":   ("bharath-on-plate.png",  48, 542, 1036),
    "manat":     ("manattt.jpeg",          64, 623, 1019),
    "nikhil":    ("nikhilv1.jpeg",         51, 626, 1035),
    "abhishrey": ("abhishrey.jpeg",        61, 516,  844),
    "nikhilc":   ("balasainikhil.jpeg",    79, 521,  878),
    "ashok":     ("ashok.jpeg",            86, 640, 1079),
    "om":        ("omi.jpeg",              79, 637, 1007),
    "vikash":    ("vikash.jpeg",           70, 620, 1004),
    "jaya":      ("jaya.jpeg",             31, 622,  960),
    "sanjay":    ("sanjayv1.jpeg",        108, 619, 1142),
    "deepam":    ("deepamv1.jpeg",         70, 626, 1168),
    "krithik":   ("krithik.jpeg",          52, 513,  827),
}

HAIR_AT, LOGO_AT = 0.085, 0.88   # where the two landmarks sit in the output frame
ASPECT = 0.8                     # 4:5, matching the card's aspect-ratio in CSS
OUT_W, OUT_H = 800, 1000

TARGET_BG = np.array([224.0, 222.0, 217.0])   # warm light grey, sits with --paper #f8f6f1
FLATTEN = 0.70                                 # how far the sweep is pulled toward flat target


def _pad(edge_row, rows, slope, rng):
    """A block of `rows` continuing `edge_row`, drifting by a damped, clamped `slope`."""
    seed = ndimage.gaussian_filter1d(edge_row, sigma=60, axis=0, mode="nearest")
    k = np.arange(rows, 0, -1)[:, None, None]
    drift = np.clip(slope[None, None, :] * k * 0.5, -8, 8)
    return np.clip(seed[None] + drift + rng.normal(0, 1.1, (rows,) + edge_row.shape), 0, 255)


def extend(a, top_rows, bottom_rows):
    """
    Grow the canvas into the flat regions above the head and below the chest.

    The slope is a single scalar per channel and clamped: an earlier version extrapolated a
    per-column slope, which on the one frame with a strong centre falloff painted a bright
    rectangle across the top.
    """
    rng = np.random.default_rng(7)
    if top_rows > 0:
        slope = np.clip((a[0] - a[40]).mean(axis=0) / 40.0, -0.25, 0.25)
        a = np.concatenate([_pad(a[0], top_rows, slope, rng), a], axis=0)
    if bottom_rows > 0:
        slope = np.clip((a[-1] - a[-41]).mean(axis=0) / 40.0, -0.25, 0.25)
        a = np.concatenate([a, _pad(a[-1], bottom_rows, slope, rng)[::-1]], axis=0)
    return a


def background_mask(a):
    """Light, low-saturation pixels connected to the frame border = the studio sweep."""
    mx, mn = a.max(axis=2), a.min(axis=2)
    cand = ((mx - mn) < 26) & (a.mean(axis=2) > 118)
    lab, _ = ndimage.label(cand)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    bg = ndimage.binary_closing(bg, np.ones((7, 7)))
    bg = ndimage.binary_erosion(bg, np.ones((5, 5)))    # step back off hair edges
    m = Image.fromarray((bg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9))
    return (np.asarray(m).astype(np.float32) / 255.0)[..., None]


def normalise_bg(a, mask):
    """Match plate level and damp the sweep's own gradient, inside the feathered mask only."""
    w = mask[..., 0]
    if w.sum() < 1000:
        return a
    mean = (a * mask).sum(axis=(0, 1)) / w.sum()
    corrected = (a + (TARGET_BG - mean)) * (1 - FLATTEN) + TARGET_BG * FLATTEN
    return np.clip(a * (1 - mask) + corrected * mask, 0, 255)


def build(name):
    src, hair, cx, logo = GEOM[name]
    a = np.asarray(Image.open(f"{SRC}/{src}").convert("RGB")).astype(np.float32)

    # Crop height falls out of wanting both landmarks at their target fractions.
    crop_h = round((logo - hair) / (LOGO_AT - HAIR_AT))
    crop_w = round(ASPECT * crop_h)
    top = round(hair - HAIR_AT * crop_h)

    top_ext = max(0, -top)
    top = max(0, top)
    bottom_ext = max(0, (top + crop_h) - (a.shape[0] + top_ext))
    a = extend(a, top_ext, bottom_ext)

    a = normalise_bg(a, background_mask(a))

    left = max(0, min(round(cx - crop_w / 2), a.shape[1] - crop_w))
    out = a[top:top + crop_h, left:left + crop_w]
    img = Image.fromarray(out.astype(np.uint8)).resize((OUT_W, OUT_H), Image.LANCZOS)
    return img, top_ext, bottom_ext, crop_h


if __name__ == "__main__":
    import sys, os
    outdir = sys.argv[1]
    os.makedirs(outdir, exist_ok=True)
    for n in GEOM:
        img, te, be, ch = build(n)
        img.save(f"{outdir}/{n}.png")
        print(f"{n:10s} crop_h={ch:5d}  ext top={te:3d} bottom={be:3d}  -> {img.size}")
