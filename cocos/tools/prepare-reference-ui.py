"""Extract reusable, data-free UI artwork from the supplied shop reference."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageOps
import json, sys, uuid

source = Path(sys.argv[1])
out = Path(__file__).resolve().parents[1] / 'assets/resources/art'
art = Image.open(source).convert('RGB')
assert art.size == (768, 1376), art.size
manifest_path = out / 'pencil-sources.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))

def patch(image, box, sample):
    tile = art.crop(sample)
    w, h = box[2] - box[0], box[3] - box[1]
    texture = Image.new('RGB', (w, h))
    for y in range(0, h, tile.height):
        for x in range(0, w, tile.width):
            texture.paste(tile, (x, y))
    result = image.copy()
    result.paste(texture, box)
    mask = Image.new('L', image.size)
    ImageDraw.Draw(mask).rectangle(box, fill=255)
    return Image.composite(result, image, mask.filter(ImageFilter.GaussianBlur(.5)))

def save(image, name, method, borders=(0, 0, 0, 0)):
    target = out / name
    image.save(target, quality=95, optimize=True)
    meta_path = Path(str(target) + '.meta')
    meta = json.loads((meta_path if meta_path.exists() else out / 'pencil-frame.png.meta').read_text(encoding='utf-8'))
    asset_id = meta['uuid'] if meta_path.exists() else str(uuid.uuid4())
    meta.update(uuid=asset_id, files=[target.suffix, '.json'])
    for key, sub in meta['subMetas'].items():
        sub.update(uuid=asset_id + '@' + key, displayName=target.stem)
        data = sub['userData']
        data['imageUuidOrDatabaseUri'] = asset_id + ('@6c48a' if key == 'f9941' else '')
        if key == 'f9941':
            data.update(trimType='none', trimX=0, trimY=0, offsetX=0, offsetY=0,
                        width=image.width, height=image.height, rawWidth=image.width, rawHeight=image.height,
                        borderLeft=borders[0], borderRight=borders[1], borderTop=borders[2], borderBottom=borders[3])
            data.pop('vertices', None)
    meta['userData'].update(hasAlpha=image.mode == 'RGBA', redirect=asset_id + '@f9941')
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    manifest['assets'] = [a for a in manifest['assets'] if a['asset'] != name]
    manifest['assets'].append(dict(asset=name, source=source.name, method=method))

home = art.copy()
for box in [(184, 165, 264, 198), (372, 165, 453, 198), (558, 165, 632, 198)]:
    home = patch(home, box, (265, 178, 271, 191))
home = patch(home, (220, 1102, 425, 1176), (219, 1097, 231, 1101))
# Navigation is drawn once, with live selection and labels on every page.
home = patch(home, (22, 1224, 704, 1375), (260, 763, 500, 776))
save(home.resize((720, 1280), Image.Resampling.LANCZOS), 'pencil-home-page.jpg',
     'Supplied home and illustrated controls; sample resource values, story state and bottom navigation removed for live UI')

neutral = patch(art, (95, 795, 359, 897), (240, 804, 300, 819)).crop((78, 784, 374, 907))
save(neutral, 'pencil-ui-neutral.jpg', 'Single cream paper button with a fine double-line border, no text or icons', (18, 18, 18, 18))
primary = patch(art, (220, 1102, 425, 1176), (219, 1097, 231, 1101)).crop((207, 1086, 439, 1185))
# Match the reference green while keeping cream action text legible.
primary = Image.eval(primary, lambda p: round(p * .83))
save(primary, 'pencil-ui-primary.jpg', 'Blank sage paper action button with cream corners', (18, 18, 18, 18))
save(art.crop((260, 763, 500, 776)).resize((680, 112)), 'pencil-paper.jpg', 'Warm cream paper texture from the supplied UI')

# Reuse the reference floral/gold corners around a blank paper center.
paper = ImageOps.fit(art.crop((260, 763, 500, 776)), (720, 900), Image.Resampling.LANCZOS)
draw = ImageDraw.Draw(paper)
draw.rounded_rectangle((20, 20, 699, 879), radius=18, outline='#b49673', width=2)
draw.rounded_rectangle((26, 26, 693, 873), radius=14, outline='#d8c6ad', width=1)
for box, pos, size in [((0, 0, 215, 236), (0, 0), (172, 189)),
                       ((582, 31, 747, 231), (576, 20), (132, 160)),
                       ((0, 1155, 171, 1376), (0, 723), (137, 177))]:
    tile = art.crop(box).resize(size, Image.Resampling.LANCZOS)
    mask = Image.new('L', size, 255)
    # Feather only the exposed paper edges into the same sampled paper.
    m = ImageDraw.Draw(mask)
    m.rectangle((size[0]-3, 0, size[0], size[1]), fill=0)
    m.rectangle((0, size[1]-3, size[0], size[1]), fill=0)
    paper.paste(tile, pos, mask.filter(ImageFilter.GaussianBlur(3)))
save(paper, 'pencil-ui-panel.jpg', 'Blank cream floral and gold dialog frame from the supplied reference', (172, 144, 190, 177))

nav = ImageOps.fit(art.crop((260, 763, 500, 776)), (720, 140), Image.Resampling.LANCZOS)
nav.paste(art.crop((0, 1226, 38, 1376)).resize((36, 140)), (0, 0))
nav.paste(art.crop((706, 1226, 768, 1376)).resize((58, 140)), (662, 0))
save(nav, 'pencil-navigation.jpg', 'Cream bottom bar with reference floral and gold edges; no baked selection, icons or labels')
for name, box in [('home', (64, 1245, 144, 1321)), ('orders', (208, 1247, 282, 1321)),
                  ('craft', (341, 1246, 424, 1323)), ('chair', (482, 1246, 559, 1323)),
                  ('album', (624, 1247, 705, 1321))]:
    tile = art.crop(box).convert('RGBA')
    if name == 'home':
        mask = Image.new('L', tile.size)
        ImageDraw.Draw(mask).polygon([(0, 31), (36, 1), (46, 1), (80, 30), (72, 38), (69, 76), (12, 76), (11, 38)], fill=255)
        tile.putalpha(mask.filter(ImageFilter.GaussianBlur(.5)))
    else:
        # Flood only the paper connected to the crop edges, retaining pale icon interiors.
        pixels = tile.load()
        seen = set()
        stack = [(x, y) for x in range(tile.width) for y in (0, tile.height-1)] + [(x, y) for y in range(tile.height) for x in (0, tile.width-1)]
        while stack:
            x, y = stack.pop()
            if (x, y) in seen or not (0 <= x < tile.width and 0 <= y < tile.height): continue
            seen.add((x, y))
            r, g, b, a = pixels[x, y]
            if r < 210 or g < 195 or b < 170: continue
            pixels[x, y] = (r, g, b, 0)
            stack.extend([(x-1, y), (x+1, y), (x, y-1), (x, y+1)])
    save(tile, 'icon-' + name + '.png', 'Hand-drawn navigation icon cropped from the supplied reference')

manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Prepared reference home, shared buttons, paper, dialogs and five navigation icons.')
