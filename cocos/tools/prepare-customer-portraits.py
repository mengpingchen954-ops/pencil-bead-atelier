"""Crop customer avatars from the user's existing character art, without baked labels."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import json, uuid

art = Path(__file__).resolve().parents[1] / 'assets/resources/art'
sheet = Path('E:/Game/手串/设计图/欧美卡通手绘_Seedream5Pro_V3/09-characters.png')
sources = {
    'lin': (art / 'pencil-dialogue-lin.png', (115, 0, 355, 240)),
    'xiaoman': (sheet, (815, 135, 1205, 525)),
    'teacher': (sheet, (1350, 50, 1790, 490)),
    'neighbor': (sheet, (275, 105, 705, 535)),
}
manifest = []
for name, (source, crop) in sources.items():
    image = Image.open(source).convert('RGBA').crop(crop).resize((320, 320), Image.Resampling.LANCZOS)
    mask = Image.new('L', image.size)
    ImageDraw.Draw(mask).ellipse((2, 2, 318, 318), fill=255)
    image.putalpha(mask.filter(ImageFilter.GaussianBlur(.5)))
    target = art / f'pencil-customer-{name}.png'
    image.save(target, optimize=True)
    meta_path = Path(str(target) + '.meta')
    meta = json.loads((meta_path if meta_path.exists() else art / 'pencil-dialogue-lin.png.meta').read_text(encoding='utf-8'))
    identity = meta['uuid'] if meta_path.exists() else str(uuid.uuid4())
    meta.update(uuid=identity, files=['.png', '.json'])
    meta['userData'].update(hasAlpha=True, redirect=identity + '@f9941')
    for key, sub in meta['subMetas'].items():
        sub.update(uuid=identity + '@' + key, displayName=target.stem)
        sub['userData']['imageUuidOrDatabaseUri'] = identity + ('@6c48a' if key == 'f9941' else '')
        if key == 'f9941':
            sub['userData'].update(trimType='none', trimX=0, trimY=0, offsetX=0, offsetY=0, width=320, height=320, rawWidth=320, rawHeight=320, borderLeft=0, borderRight=0, borderTop=0, borderBottom=0)
            sub['userData'].pop('vertices', None)
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    manifest.append(dict(asset=target.name, source=source.name, crop=list(crop), method='Head-and-shoulders crop with feathered circular alpha; existing user-provided artwork'))
(art / 'customer-portrait-sources.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Prepared four customer avatars from existing artwork.')
