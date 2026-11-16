"""Normalize the approved Dreamina side-view batch, removing only its magenta backdrop."""
from pathlib import Path
from collections import deque
from PIL import Image, ImageDraw
import json, sys
import numpy as np

root = Path(__file__).resolve().parents[1]
inputs = Path(sys.argv[1])
folder = root / 'source-art/material-overrides'
manifest = folder / 'manifest.json'
records = json.loads(manifest.read_text(encoding='utf-8'))
specs = json.loads((inputs / 'side-specs.json').read_text(encoding='utf-8'))
preview = Image.new('RGB', (1000, 810), '#eee7d9')
draw = ImageDraw.Draw(preview)
for index, spec in enumerate(specs):
    type_id = spec['type']
    submitted = json.loads((inputs / f'{type_id}-side-submit.json').read_text(encoding='utf-8'))
    args = json.loads((inputs / f'{type_id}-side-command.json').read_text(encoding='utf-8'))['args']
    source = inputs / f'{type_id}-side' / (submitted['submit_id'] + '_image_1.png')
    image = Image.open(source).convert('RGB')
    image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    rgb = np.asarray(image).astype(np.int16)
    backdrop = (rgb[:, :, 0] - rgb[:, :, 1] > 55) & (rgb[:, :, 2] - rgb[:, :, 1] > 25) & (rgb[:, :, 0] > 150)
    if type_id == 83:  # Dreamina returned a red backdrop for the olive crystal.
        backdrop |= (rgb[:, :, 0] - rgb[:, :, 1] > 75) & (rgb[:, :, 0] - rgb[:, :, 2] > 50)
    foreground = ~backdrop
    # Remove isolated generator speckles while retaining separate gemstones and openwork holes.
    seen = np.zeros(foreground.shape, dtype=bool)
    mask = np.zeros(foreground.shape, dtype=np.uint8)
    height, width = foreground.shape
    for y, x in zip(*np.where(foreground)):
        if seen[y, x]:
            continue
        queue = deque([(int(y), int(x))]); seen[y, x] = True; component = []
        while queue:
            cy, cx = queue.popleft(); component.append((cy, cx))
            for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < height and 0 <= nx < width and foreground[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; queue.append((ny, nx))
        if len(component) >= 16:
            ys, xs = zip(*component); mask[ys, xs] = 255
    alpha = Image.fromarray(mask)
    bounds = alpha.getbbox()
    assert bounds and min(bounds[:2]) > 0 and bounds[2] < width and bounds[3] < height, spec['name']
    rgba = image.convert('RGBA'); rgba.putalpha(alpha)
    # Fit the complete silhouette; never impose a circle/rectangle cutout on the material.
    rgba = rgba.crop(bounds)
    rgba.thumbnail((188, 188), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (192, 192))
    canvas.alpha_composite(rgba, ((192 - rgba.width) // 2, (192 - rgba.height) // 2))
    canvas.save(folder / Path(spec['asset']).name, optimize=True)
    record = dict(type=type_id, name=spec['name'], source='Dreamina text2image ' + submitted['submit_id'],
                  method='Strict 90-degree side orthographic generation; chroma backdrop removed; complete silhouette uniformly fitted with transparent margins',
                  submit_id=submitted['submit_id'], status='success', threaded=True, prompt=args[args.index('--prompt') + 1])
    records = [r for r in records if r['type'] != type_id] + [record]
    display = canvas.resize((240, 240), Image.Resampling.LANCZOS)
    x, y = index % 4 * 250, index // 4 * 270
    preview.paste(display, (x + 5, y), display); draw.text((x + 8, y + 248), str(type_id), fill='black')
manifest.write_text(json.dumps(sorted(records, key=lambda r: r['type']), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
preview.save(inputs / 'transparent-review.jpg')
print('Prepared', len(specs), 'complete side-view sprites')
