"""Prepare the user's complete cover without cropping or stretching its layout."""
from pathlib import Path
from PIL import Image, ImageOps
import json, sys

source = Path(sys.argv[1])
out = Path(__file__).resolve().parents[1] / 'assets/resources/art'
image = ImageOps.contain(Image.open(source).convert('RGB'), (1140, 2040), Image.Resampling.LANCZOS)
target = out / 'pencil-cover.jpg'
image.save(target, quality=94, optimize=True)
meta_path = Path(str(target) + '.meta')
meta = json.loads(meta_path.read_text(encoding='utf-8'))
data = meta['subMetas']['f9941']['userData']
data.update(trimType='none', trimX=0, trimY=0, offsetX=0, offsetY=0,
            width=image.width, height=image.height, rawWidth=image.width, rawHeight=image.height)
data.pop('vertices', None)
meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
manifest_path = out / 'pencil-sources.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['assets'] = [a for a in manifest['assets'] if a['asset'] != target.name]
manifest['assets'].append(dict(asset=target.name, source=source.name,
    method='User-supplied complete floral cover; proportional resize to 1140×2040, JPEG quality 94; native start hit area over the painted button'))
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Prepared {target.name}: {image.width}×{image.height}, {target.stat().st_size} bytes')
