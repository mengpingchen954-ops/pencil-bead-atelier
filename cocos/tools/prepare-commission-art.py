"""Extract blank workshop illustrations; every bead and control is a live Cocos node."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFilter
import json, sys, uuid

source = Path(sys.argv[1])
out = Path(__file__).resolve().parents[1] / 'assets/resources/art'
art = ImageOps.contain(Image.open(source).convert('RGB'), (720, 1290), Image.Resampling.LANCZOS)
manifest_path = out / 'pencil-sources.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['assets'] = [a for a in manifest['assets'] if a['asset'] != 'pencil-commission-tray.jpg']

def blank(image, bounds, sample, feather=2):
    patch = image.copy()
    patch.paste(art.crop(sample).resize((bounds[2]-bounds[0], bounds[3]-bounds[1]), Image.Resampling.BICUBIC), bounds)
    mask = Image.new('L', image.size)
    ImageDraw.Draw(mask).rectangle(bounds, fill=255)
    return Image.composite(patch, image, mask.filter(ImageFilter.GaussianBlur(feather)))

def save(image, name, method):
    target = out / name
    image.save(target, **({'quality':94, 'optimize':True} if name.endswith('.jpg') else {'optimize':True}))
    path = Path(str(target)+'.meta')
    meta = json.loads((path if path.exists() else out/'pencil-handover.jpg.meta').read_text(encoding='utf-8'))
    asset_id = meta['uuid'] if path.exists() else str(uuid.uuid4())
    meta.update(uuid=asset_id, files=['.json', target.suffix])
    for key, sub in meta['subMetas'].items():
        sub.update(uuid=asset_id+'@'+key, displayName=target.stem)
        data = sub['userData']
        data['imageUuidOrDatabaseUri'] = asset_id+('@6c48a' if key=='f9941' else '')
        if key=='f9941':
            data.update(trimType='none', trimX=0, trimY=0, offsetX=0, offsetY=0, width=image.width, height=image.height, rawWidth=image.width, rawHeight=image.height)
            data.pop('vertices', None)
    meta['userData'].update(hasAlpha=image.mode=='RGBA', redirect=asset_id+'@f9941')
    path.write_text(json.dumps(meta, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    manifest['assets'] = [a for a in manifest['assets'] if a['asset'] != name]
    manifest['assets'].append(dict(asset=name, source=source.name, method=method))

header = blank(art, (244,54,480,105), (283,119,432,129))
header = blank(header, (270,178,454,412), (279,176,441,197))
save(header.crop((0,0,720,490)), 'pencil-commission-shop.jpg', 'Proportion-preserved shop with heroine and grandmother; banner lettering and entire example requirement/bracelet removed for native order state')
tray = blank(art, (159,545,555,901), (93,826,146,867), 5)
tray.paste(art.crop((288,901,313,938)), (245,901))
tray = tray.crop((46,514,674,938)).convert('RGBA')
mask = Image.new('L', tray.size)
ImageDraw.Draw(mask).polygon([(61,0),(566,0),(628,398),(608,423),(18,423),(0,398)], fill=255)
tray.putalpha(mask.filter(ImageFilter.GaussianBlur(1)))
save(tray, 'pencil-commission-tray.png', 'Blank wooden tray; removed example beads, ring, arrows, highlights and side controls; real round grooves rendered natively')
scroll = blank(art, (74,951,642,1134), (281,176,438,196), 2)
scroll.paste(art.crop((276,939,326,955)), (200,939))
save(scroll.crop((18,939,702,1142)), 'pencil-commission-scroll.jpg', 'Blank paper scroll for actual inventory palette, no baked bead choices')
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Prepared commission shop, empty tray and material scroll')
