"""Prepare blank collection-detail paper; saved works and all controls stay native."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
import json, sys, uuid

source = Path(sys.argv[1])
out = Path(__file__).resolve().parents[1] / 'assets/resources/art'
art = ImageOps.contain(Image.open(source).convert('RGB'), (720, 1290), Image.Resampling.LANCZOS)
manifest_path = out / 'pencil-sources.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))

def paper(size):
    tile = art.crop((270, 62, 350, 94))
    result = Image.new('RGB', size)
    for y in range(0, size[1], tile.height):
        for x in range(0, size[0], tile.width):
            result.paste(ImageOps.mirror(tile) if (x//tile.width+y//tile.height)%2 else tile, (x, y))
    return result

def save(im, name, description):
    target = out / name
    im.save(target, quality=94, optimize=True)
    path = Path(str(target)+'.meta')
    meta = json.loads((path if path.exists() else out/'pencil-album-frame.jpg.meta').read_text(encoding='utf-8'))
    asset_id = meta['uuid'] if path.exists() else str(uuid.uuid4())
    meta.update(uuid=asset_id, files=['.json', target.suffix])
    for key, sub in meta['subMetas'].items():
        sub.update(uuid=asset_id+'@'+key, displayName=target.stem)
        data = sub['userData']
        data['imageUuidOrDatabaseUri'] = asset_id+('@6c48a' if key=='f9941' else '')
        if key=='f9941':
            data.update(trimType='none', trimX=0, trimY=0, offsetX=0, offsetY=0, width=im.width, height=im.height, rawWidth=im.width, rawHeight=im.height)
            data.pop('vertices', None)
    meta['userData'].update(hasAlpha=False, redirect=asset_id+'@f9941')
    path.write_text(json.dumps(meta, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    manifest['assets'] = [a for a in manifest['assets'] if a['asset'] != name]
    manifest['assets'].append(dict(asset=name, source=source.name, method=description))

frame = paper(art.size)
mask = Image.new('L', art.size)
draw = ImageDraw.Draw(mask)
draw.rectangle((0, 34, 43, 1260), fill=255)
draw.rectangle((677, 34, 719, 1260), fill=255)
draw.rectangle((40, 36, 680, 46), fill=255)
draw.rectangle((40, 1247, 680, 1260), fill=255)
draw.polygon([(0,34),(230,34),(208,61),(161,92),(137,144),(85,186),(50,280),(0,300)], fill=255)
draw.polygon([(535,34),(719,34),(719,250),(680,222),(659,137),(576,94)], fill=255)
draw.polygon([(0,1006),(47,1050),(80,1126),(147,1170),(215,1206),(316,1251),(316,1289),(0,1289)], fill=255)
draw.polygon([(719,961),(680,961),(660,1000),(675,1080),(632,1155),(571,1190),(520,1260),(520,1289),(719,1289)], fill=255)
frame = Image.composite(art, frame, mask)
frame.paste(ImageOps.flip(art.crop((0,34,720,68))), (0,0))
frame.paste(paper((392,25)), (108,1265))
save(frame, 'pencil-collection-detail-frame.jpg', 'Floral lace and gold frame only; removed phone status/home bars, sample work, title, portrait, stamp, materials, labels and buttons')

card = paper((533,189))
card_draw = ImageDraw.Draw(card)
card_draw.rectangle((2,2,530,186), outline='#a98972', width=2)
card_draw.rectangle((10,10,522,178), outline='#d7bea0', width=1)
save(card, 'pencil-collection-detail-card.jpg', 'Blank memory-card border; removed sample portrait and text')
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Prepared collection-detail frame and blank memory card')

