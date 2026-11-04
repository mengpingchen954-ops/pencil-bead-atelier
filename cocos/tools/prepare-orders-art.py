"""Separate the supplied commission-list artwork from all live game values."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFilter
import json, sys, uuid

source = Path(sys.argv[1])
out = Path(__file__).resolve().parents[1] / 'assets/resources/art'
art = ImageOps.contain(Image.open(source).convert('RGB'), (1140, 2040), Image.Resampling.LANCZOS)
scale = art.width / 715
def bounds(rect):
    return tuple(round(n * scale) for n in rect)
def patch(image, rect, sample):
    box = bounds(rect)
    tile = art.crop(bounds(sample))
    width, height = box[2]-box[0], box[3]-box[1]
    tile = tile.resize((width, max(1, round(tile.height*width/tile.width))), Image.Resampling.LANCZOS)
    texture = Image.new('RGB', (width, height))
    for y in range(0, height, tile.height):
        texture.paste(tile if y//tile.height % 2 == 0 else ImageOps.flip(tile), (0,y))
    result = image.copy(); result.paste(texture, box)
    mask = Image.new('L', image.size); ImageDraw.Draw(mask).rectangle(box, fill=255)
    return Image.composite(result, image, mask.filter(ImageFilter.GaussianBlur(1.5*scale)))

manifest_path = out / 'pencil-sources.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
def save(image, name, method):
    target = out / name
    image.save(target, quality=94, optimize=True)
    path = Path(str(target)+'.meta')
    meta = json.loads((path if path.exists() else out/'pencil-cover.jpg.meta').read_text(encoding='utf-8'))
    asset_id = meta['uuid'] if path.exists() else str(uuid.uuid4())
    meta.update(uuid=asset_id, files=['.jpg','.json'])
    for key, sub in meta['subMetas'].items():
        sub.update(uuid=asset_id+'@'+key, displayName=target.stem)
        data = sub['userData']; data['imageUuidOrDatabaseUri'] = asset_id+('@6c48a' if key=='f9941' else '')
        if key == 'f9941':
            data.update(trimType='none',trimX=0,trimY=0,offsetX=0,offsetY=0,width=image.width,height=image.height,rawWidth=image.width,rawHeight=image.height)
            data.pop('vertices',None)
    meta['userData'].update(hasAlpha=False,redirect=asset_id+'@f9941')
    path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    manifest['assets'] = [a for a in manifest['assets'] if a['asset'] != name]
    manifest['assets'].append(dict(asset=name,source=source.name,method=method))

green = patch(art,(446,452,647,489),(463,444,635,452))
neutral = patch(art,(445,690,648,728),(461,682,636,691))
save(green.crop(bounds((439,439,654,501))),'pencil-orders-primary.jpg','Blank painted green button; example reward and action text removed')
save(neutral.crop(bounds((439,678,654,740))),'pencil-orders-neutral.jpg','Blank neutral button; example locked-state text removed')
page = art.copy()
for rect, sample in [
    ((334,30,421,63),(338,65,421,69)),
    ((441,30,534,65),(441,74,535,84)),
    ((551,28,611,63),(552,65,609,68)),
    ((48,237,298,267),(50,273,299,285)),
    ((187,331,577,421),(191,422,430,436)),
    ((67,457,430,491),(191,422,430,436)),
    ((187,567,576,660),(191,661,429,676)),
    ((67,696,431,731),(191,661,429,676)),
    ((187,805,577,898),(191,899,430,913)),
    ((67,932,432,970),(191,899,430,913)),
    ((436,435,657,505),(191,422,430,436)),
    ((84,1043,257,1081),(92,1035,253,1043)),
    ((459,1043,630,1081),(464,1035,627,1043)),
    ((322,1045,405,1082),(300,1101,409,1115)),
]:
    page = patch(page,rect,sample)
# Row badges depict the daisy/moon/heart charms, in the same order on both pages.
blank = neutral.crop(bounds((439,678,654,740)))
for y in [439,678,916]:
    page.paste(blank,bounds((439,y,654,y+62)))
save(page,'pencil-orders-page.jpg','Floral paper, three blank commission cards with charm badges and floral sprigs, static heading and navigation; all sample stock, coins, energy, progress, customer/order/requirements, action labels and page numbers removed')
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Prepared commission page and two blank painted button states')
