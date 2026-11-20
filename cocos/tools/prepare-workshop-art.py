"""Prepare the supplied workshop painting without sample labels or inventory."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import json

root = Path(__file__).resolve().parents[1]
art = root / 'assets/resources/art'
source = Image.open(root / 'source-art/workshop-reference.png').convert('RGB')
assert source.size == (1520, 2720)

def patch(image, box, sample, feather=3):
    tile = image.crop(sample).resize((box[2]-box[0], box[3]-box[1]), Image.Resampling.BICUBIC)
    mask = Image.new('L', tile.size, 255)
    if feather:
        mask = Image.new('L', tile.size)
        ImageDraw.Draw(mask).rectangle((feather, feather, tile.width-feather, tile.height-feather), fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(feather))
    image.paste(tile, box[:2], mask)

def save(image, name):
    target = art / name
    image.save(target, optimize=True, **({'quality':94} if target.suffix == '.jpg' else {}))
    meta = Path(str(target)+'.meta')
    data = json.loads(meta.read_text(encoding='utf-8'))
    data['userData']['hasAlpha'] = image.mode == 'RGBA'
    for key, sub in data['subMetas'].items():
        if key == 'f9941':
            sub['userData'].update(trimType='none', trimX=0, trimY=0, offsetX=0, offsetY=0,
                width=image.width, height=image.height, rawWidth=image.width, rawHeight=image.height)
            sub['userData'].pop('vertices', None)
    meta.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

stage = source.copy()
# Replace the printed guide with neighboring tray paint; the game draws its live wire.
pixels, original = stage.load(), source.load()
for y in range(535, 1365):
    for x in range(340, 1170):
        dx, dy = x-759, y-951
        radius = (dx*dx+dy*dy)**.5
        if 374 < radius < 406:
            ratio = (radius-38)/radius
            pixels[x,y] = original[round(759+dx*ratio), round(951+dy*ratio)]
patch(stage, (440,875,1080,986), (440,736,1080,847), 9)
patch(stage, (680,978,846,1027), (680,1040,846,1089), 7)
plate = stage.crop((80,297,1436,1615)).resize((640,640), Image.Resampling.LANCZOS).convert('RGBA')
mask = Image.new('L', plate.size)
ImageDraw.Draw(mask).ellipse((1,1,639,639), fill=255)
plate.putalpha(mask.filter(ImageFilter.GaussianBlur(.6)))
save(plate, 'pencil-diy-plate.png')

for box, sample in [
    ((134,59,367,135),(132,131,367,143)),
    ((584,77,936,163),(1005,83,1075,163)),
    ((1295,64,1422,135),(1237,65,1273,135)),
    ((440,190,1091,245),(1074,203,1090,232)),
    ((270,1665,1290,1755),(496,1665,515,1755)),
    ((1252,2563,1386,2622),(1235,2573,1250,2616)),
    ((620,2538,935,2617),(960,2537,1018,2617)),
]:
    patch(stage, box, sample)
# Retain the painted material frame; native cards contain real bead art and stock.
patch(stage, (119,1776,1396,2398), (122,2428,1392,2460), 6)
save(stage.resize((720,1280), Image.Resampling.LANCZOS), 'pencil-diy-stage.jpg')
print('Prepared workshop stage and tray from workshop-reference.png')
