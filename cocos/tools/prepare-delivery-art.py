"""Extract only the handover illustration; rewards, artwork and buttons stay native UI."""
from pathlib import Path
from PIL import Image, ImageOps
import json, sys, uuid

source = Path(sys.argv[1])
out = Path(__file__).resolve().parents[1] / 'assets/resources/art'
image = Image.open(source).convert('RGB')
hero = image.crop((0, 0, image.width, round(image.width * 1220 / 1143)))
hero = ImageOps.fit(hero, (720, 768), Image.Resampling.LANCZOS)
target = out / 'pencil-handover.jpg'
hero.save(target, quality=94, optimize=True)
meta_path = Path(str(target) + '.meta')
meta = json.loads((meta_path if meta_path.exists() else out / 'pencil-delivery.jpg.meta').read_text(encoding='utf-8'))
asset_id = meta['uuid'] if meta_path.exists() else str(uuid.uuid4())
meta['uuid'] = asset_id
meta['files'] = ['.json', '.jpg']
for key, sub in meta['subMetas'].items():
    sub['uuid'] = asset_id + '@' + key
    sub['displayName'] = target.stem
    data = sub['userData']
    data['imageUuidOrDatabaseUri'] = asset_id + ('@6c48a' if key == 'f9941' else '')
    if key == 'f9941':
        data.update(trimType='none', trimX=0, trimY=0, offsetX=0, offsetY=0,
                    width=720, height=768, rawWidth=720, rawHeight=768)
        data.pop('vertices', None)
meta['userData'].update(hasAlpha=False, redirect=asset_id+'@f9941')
meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
manifest_path = out / 'pencil-sources.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['assets'] = [a for a in manifest['assets'] if a['asset'] != target.name]
manifest['assets'].append(dict(asset=target.name, source=source.name, cropAt1143x2048=[0,0,1143,1220],
                              method='Handover illustration only; contain source proportions with a small edge crop; native live receipt UI'))
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Prepared handover illustration:', target)
