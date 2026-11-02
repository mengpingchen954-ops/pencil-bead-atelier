"""Extract the supplied dialogue illustration, removing fixed interface text."""
from pathlib import Path
from PIL import Image, ImageOps
import json, sys, uuid

source = Path(sys.argv[1])
out = Path(__file__).resolve().parents[1] / 'assets/resources/art'
image = ImageOps.contain(Image.open(source).convert('RGB'), (720, 1400), Image.Resampling.LANCZOS)
# Continue the same horizontal wall bands over the reference's fixed controls.
image.paste(image.crop((382, 45, 542, 138)), (550, 45))
# Keep the illustrated sign; its title is a live Label.
image.paste(image.crop((248, 310, 280, 358)).resize((153, 48), Image.Resampling.LANCZOS), (286, 310))
image = image.crop((0, 0, 720, 930))
target = out / 'pencil-dialogue-stage.jpg'
image.save(target, quality=94, optimize=True)
meta_path = Path(str(target) + '.meta')
meta = json.loads((meta_path if meta_path.exists() else out / 'pencil-handover.jpg.meta').read_text(encoding='utf-8'))
asset_id = meta['uuid'] if meta_path.exists() else str(uuid.uuid4())
meta['uuid'] = asset_id
for key, sub in meta['subMetas'].items():
    sub['uuid'] = asset_id + '@' + key
    sub['displayName'] = target.stem
    data = sub['userData']
    data['imageUuidOrDatabaseUri'] = asset_id + ('@6c48a' if key == 'f9941' else '')
    if key == 'f9941':
        data.update(width=720, height=930, rawWidth=720, rawHeight=930)
        data.pop('vertices', None)
meta['userData'].update(redirect=asset_id+'@f9941')
meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
manifest_path = out / 'pencil-sources.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['assets'] = [a for a in manifest['assets'] if a['asset'] != target.name]
manifest['assets'].append(dict(asset=target.name, source=source.name,
    method='Proportion-preserved upper dialogue illustration; remove baked title and controls with sampled blank wall/sign; native dialogue panel covers lower edge'))
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Prepared dialogue illustration:', target)
