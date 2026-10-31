"""Extract production-sized sprites from the user's 铅笔2 reference boards.
Run with Pillow: python tools/prepare-pencil-art.py E:/Game/手串/铅笔2
Coordinates use the 1143 x 2048 review scale; source boards remain untouched.
"""
from pathlib import Path
from collections import deque
from PIL import Image, ImageOps, ImageDraw, ImageFilter, ImageChops
import json, sys, uuid, copy, random

source = Path(sys.argv[1])
project = Path(__file__).resolve().parents[1]
out = project / 'assets/resources/art'
template = json.loads((out / 'icon-home.png.meta').read_text(encoding='utf-8'))
records = []

def crop(file, box):
    im = Image.open(source / file).convert('RGB')
    return im.crop(tuple(round(v * im.width / 1143) for v in box))

def save(im, name, size, origin, box=None, method='Crop and resize'):
    im = im.resize(size, Image.Resampling.LANCZOS)
    target = out / name
    if target.suffix == '.jpg':
        im.convert('RGB').save(target, quality=91, optimize=True)
    else:
        im.save(target, optimize=True)
    meta_path = Path(str(target) + '.meta')
    meta = json.loads(meta_path.read_text(encoding='utf-8')) if meta_path.exists() else copy.deepcopy(template)
    asset_uuid = meta['uuid'] if meta_path.exists() else str(uuid.uuid4())
    meta['uuid'] = asset_uuid
    meta['files'] = ['.json', target.suffix]
    for key, sub in meta['subMetas'].items():
        sub['uuid'] = asset_uuid + '@' + key
        sub['displayName'] = target.stem
        data = sub['userData']
        data['imageUuidOrDatabaseUri'] = asset_uuid + ('@6c48a' if key == 'f9941' else '')
        if key == 'f9941':
            w,h = size
            data.update(trimType='none',trimX=0,trimY=0,offsetX=0,offsetY=0,width=w,height=h,rawWidth=w,rawHeight=h)
            data.pop('vertices',None)
    meta['userData'].update(hasAlpha=target.suffix=='.png',redirect=asset_uuid+'@f9941')
    meta_path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    records.append(dict(asset=name,source=origin,cropAt1143x2048=box,method=method))
    return im

def isolate(file, box, name, size=(160,160)):
    im = crop(file, box).convert('RGBA')
    w,h = im.size
    pixels = im.load()
    mask = Image.new('L',im.size,255)
    mp = mask.load()
    queue = deque([(x,y) for x in range(w) for y in (0,h-1)] + [(x,y) for y in range(h) for x in (0,w-1)])
    seen = set()
    while queue:
        x,y = queue.popleft()
        if (x,y) in seen or not (0<=x<w and 0<=y<h): continue
        seen.add((x,y))
        r,g,b,_ = pixels[x,y]
        # Remove connected cream paper only. Enclosed pearl highlights stay intact.
        threshold = 207 if 'daisy' in name else 155
        if r>threshold and g>threshold-16 and b>threshold-45 and r>=g-3 and g>=b-4 and r-g<47:
            mp[x,y]=0
            queue.extend(((x-1,y),(x+1,y),(x,y-1),(x,y+1)))
    im.putalpha(mask.filter(ImageFilter.GaussianBlur(.45)))
    bounds=im.getbbox()
    if bounds: im=im.crop(bounds)
    canvas=Image.new('RGBA',size)
    im=ImageOps.contain(im,(size[0]-18,size[1]-18),Image.Resampling.LANCZOS)
    canvas.alpha_composite(im,((size[0]-im.width)//2,(size[1]-im.height)//2))
    return save(canvas,name,size,file,box,'Crop; remove connected paper background; preserve enclosed highlights')

room='33ea85ec227c3784a7322cdb208d8283.png'
match='31ceb56afa2327802678707fe5ca2276.png'
work='f1173b92b6d1e99c4146c66808e46082.png'
save(crop(room,(91,241,1052,1013)),'pencil-shop.jpg',(960,772),room,(91,241,1052,1013))
save(crop(match,(20,150,1123,757)),'pencil-counter.jpg',(1104,608),match,(20,150,1123,757))
save(crop(match,(20,236,1123,610)),'pencil-match-banner.jpg',(1104,374),match,(20,236,1123,610))
save(crop(work,(194,340,1035,882)),'pencil-workshop.jpg',(1008,650),work,(194,340,1035,882))
save(crop(room,(91,241,1052,1013)),'pencil-cover.jpg',(960,772),room,(91,241,1052,1013))
save(crop('7c3cbc7c2fdd8028625e24557a283ddc.png',(41,90,1101,637)),'pencil-delivery.jpg',(960,496),'7c3cbc7c2fdd8028625e24557a283ddc.png',(41,90,1101,637))
paper=crop(room,(400,1044,740,1100))
save(paper,'pencil-paper.jpg',(680,112),room,(400,1044,740,1100),'Blank paper texture strip')
save(crop(work,(520,960,650,1040)),'pencil-felt.jpg',(390,240),work,(520,960,650,1040),'Blank section of illustrated beading pad')

# The six match symbols retain their existing gameplay identities and silhouettes.
for i,box in enumerate([(211,830,286,909),(397,833,472,906),(480,830,569,910),(669,831,751,910),(759,826,844,910),(853,1008,935,1093)]):
    isolate(match,box,'pencil-bead-'+str(i)+'.png')
for name,box in [('daisy',(220,1494,320,1586)),('moon',(343,1499,430,1585)),('heart',(453,1580,543,1664))]:
    isolate(work,box,'pencil-charm-'+name+'.png')
chairs='f96f3a5928fac7947009ea952bf5b020.png'
for name,box in [('wood',(156,1038,331,1331)),('sage',(484,1040,657,1325)),('blue',(781,1070,1016,1317))]:
    isolate(chairs,box,'pencil-chair-'+name+'.png',(176,264))

# Keep just the outer frame and floral corner pieces, with a transparent play area.
frame=Image.open(source/work).convert('RGBA').resize((720,1280),Image.Resampling.LANCZOS)
mask=Image.new('L',frame.size,0); d=ImageDraw.Draw(mask)
d.rectangle((14,14,705,1265),outline=255,width=14)
d.polygon([(0,0),(225,0),(103,103),(0,236)],fill=255)
d.polygon([(720,0),(720,245),(548,119),(554,0)],fill=255)
d.polygon([(0,1170),(155,1250),(155,1280),(0,1280)],fill=255)
d.polygon([(720,1025),(611,1096),(488,1245),(553,1280),(720,1280)],fill=255)
frame.putalpha(mask)
save(frame,'pencil-frame.png',(720,1280),work,None,'Outer frame and floral corners only; transparent center')

# An empty perspective tray, rebuilt from the sampled suede instead of shipping
# a screenshot with fixed beads. Every bead remains a separate Cocos node.
scale=2; tray=Image.new('RGBA',(640*scale,334*scale)); draw=ImageDraw.Draw(tray)
def poly(points,fill,outline='#aa8865',width=2):
    points=[(x*scale,y*scale) for x,y in points]
    draw.polygon(points,fill=fill)
    draw.line(points+[points[0]],fill=outline,width=width*scale,joint='curve')
poly([(63,15),(577,15),(632,313),(617,330),(23,330),(8,313)],'#b99571')
poly([(63,5),(577,5),(632,310),(8,310)],'#dfc7a1')
poly([(75,17),(565,17),(612,293),(28,293)],'#f2e3c6')
mask=Image.new('L',tray.size);ImageDraw.Draw(mask).polygon([(x*scale,y*scale) for x,y in [(86,29),(554,29),(596,280),(44,280)]],fill=255)
felt=crop(work,(520,960,650,1040)).resize(tray.size,Image.Resampling.LANCZOS).convert('RGBA')
tray=Image.composite(felt,tray,mask);draw=ImageDraw.Draw(tray)
for bounds,col,width in [((69,40,571,294),'#cfb892',3),((90,53,550,281),'#ae906c',2),((102,59,538,275),'#f7ebd1',3)]:
    draw.ellipse(tuple(v*scale for v in bounds),outline=col,width=width*scale)
save(tray,'pencil-tray.png',(960,501),work,(520,960,650,1040),'Sampled suede; rebuilt empty trapezoid tray and groove')

# Paper and hand-drawn plank strokes keep the independently upgradable room
# surfaces close to the colored-pencil references. The native sprite is tinted.
floor=ImageOps.grayscale(paper.resize((1208,488),Image.Resampling.LANCZOS)).convert('RGBA')
draw=ImageDraw.Draw(floor); rng=random.Random(61)
for i in range(1,10):
    t=i/10
    points=[(604*t+j*12,244-244*t+j*4.88+rng.uniform(-1,1)) for j in range(51)]
    draw.line(points,fill=(157,140,117,255),width=2)
    points=[(604*t+j*12,244+244*t-j*4.88+rng.uniform(-.7,.7)) for j in range(51)]
    draw.line(points,fill=(174,158,134,255),width=2)
for i in range(75):
    x=rng.randrange(1208);y=rng.randrange(488)
    draw.arc((x,y,x+rng.randrange(30,140),y+8),0,150,fill=(174,159,138,100),width=1)
mask=Image.new('L',floor.size);ImageDraw.Draw(mask).polygon([(0,244),(604,0),(1208,244),(604,488)],fill=255)
floor.putalpha(mask)
save(floor,'pencil-floor.png',(1208//2,488//2),room,(400,1044,740,1100),'Paper grain; hand-drawn perspective plank seams; transparent exterior')
wall=paper.resize((720,430),Image.Resampling.LANCZOS).convert('RGBA')
mask=Image.new('L',wall.size);draw=ImageDraw.Draw(mask)
draw.polygon([(58,134),(360,12),(360,170),(58,292)],fill=85)
draw.polygon([(360,12),(662,134),(662,292),(360,170)],fill=70)
wall.putalpha(mask)
save(wall,'pencil-plaster.png',(720,430),room,(400,1044,740,1100),'Sampled colored-pencil paper on transparent room wall silhouettes')

# Source artwork is retained by reference; only intended game crops are packaged.
(out/'pencil-sources.json').write_text(json.dumps(dict(sourceDirectory=str(source),assets=records),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assert len(records)==24, len(records)
for record in records:
    im=Image.open(out/record['asset'])
    assert im.width<=1104 and im.height<=1280
print('Prepared',len(records),'Cocos textures from',source)
