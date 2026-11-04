from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
import json, uuid
root=Path('cocos/assets/resources'); src=Path('E:/Game/手串/UI/游戏全界面截图-20261104/02-订单与手串制作')
files=['011-制作台-空手串.png','011-制作台-空手串2.png','011-制作台-空手串3.png','011-制作台-空手串4.png']
images=[Image.open(src/f).convert('RGB').resize((720,1280),Image.Resampling.LANCZOS) for f in files]
print([Image.open(src/f).size for f in files])
template=json.loads((root/'beads/bead-0.png.meta').read_text())
def save(im,folder,name):
    path=root/folder/name; im.save(path,optimize=True,**({'quality':94} if path.suffix=='.jpg' else {}))
    mp=Path(str(path)+'.meta'); m=json.loads(mp.read_text()) if mp.exists() else json.loads(json.dumps(template)); uid=m['uuid'] if mp.exists() else str(uuid.uuid4())
    m.update(uuid=uid,files=['.json',path.suffix]); m['userData'].update(hasAlpha=im.mode=='RGBA',redirect=uid+'@f9941')
    for key,sub in m['subMetas'].items():
        sub.update(uuid=uid+'@'+key,displayName=path.stem);d=sub['userData'];d['imageUuidOrDatabaseUri']=uid+('@6c48a' if key=='f9941' else '')
        if key=='f9941':
            d.update(trimType='none',offsetX=0,offsetY=0,trimX=0,trimY=0,width=im.width,height=im.height,rawWidth=im.width,rawHeight=im.height,borderTop=0,borderBottom=0,borderLeft=0,borderRight=0); d.pop('vertices',None)
    mp.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# Retain the illustrated flowers, tools and real empty tray. Clear all baked labels and controls.
stage=images[0].copy();paper=images[0].crop((225,99,480,108))
for box,fill in [((64,24,177,64),'#f9eade'),((595,24,680,64),'#fbe5dc'),((255,25,459,77),'#faf8f5'),((151,103,565,135),'#faf8f5')]:
    stage.paste(Image.new('RGB',(box[2]-box[0],box[3]-box[1]),fill),box[:2])
# Reference lower area becomes a clean native material grid; retain the outer flowers.
blank=Image.new('RGB',(584,338),'#f8f4f0');stage.paste(blank,(68,768))
# Clear tabs, size, finish and helper sample text while preserving floral edges.
for box in [(112,714,610,769),(83,1047,640,1100),(222,1111,497,1170),(211,1175,516,1203)]:
    tile=Image.new('RGB',(box[2]-box[0],box[3]-box[1]),'#f8f5f0');stage.paste(tile,box[:2])
save(stage,'art','pencil-diy-stage.jpg')
content=(Path('cocos/assets/scripts/content.ts').read_text(encoding='utf-8')); beads=json.loads(content.split('export const BEADS = ')[1].split(';')[0]);
# Extract each supplied round bead at its actual edge; feather the alpha by half a pixel.
for i,b in enumerate(beads):
    im=images[b['category']];cx=[146,286,425,565][b['cell']%4];cy=[805,896,988][b['cell']//4];r=31
    tile=im.crop((cx-r-1,cy-r-1,cx+r+1,cy+r+1)).convert('RGBA');mask=Image.new('L',tile.size);ImageDraw.Draw(mask).ellipse((1,1,63,63),fill=255);tile.putalpha(mask.filter(ImageFilter.GaussianBlur(.35)));save(tile.resize((192,192),Image.Resampling.LANCZOS),'beads',f'bead-{i}.png')
# Flood only the connected pale card backdrop; retain white pearls inside the gold outlines.
from collections import deque
ids=['sakura','butterfly','star','moon','bow','pearl','drop','leaf','bell','tassel','daisy','heart']
for i,id in enumerate(ids):
    cx=[146,286,425,565][i%4];cy=[805,896,988][i//4];tile=images[3].crop((cx-35,cy-35,cx+36,cy+36)).convert('RGBA');pix=tile.load();w,h=tile.size;q=deque([(x,y) for x in range(w) for y in [0,h-1]]+[(x,y) for y in range(h) for x in [0,w-1]]);seen=set()
    while q:
        x,y=q.popleft()
        if (x,y) in seen or not(0<=x<w and 0<=y<h):continue
        seen.add((x,y));r,g,b,a=pix[x,y]
        if min(r,g,b)<211 or max(r,g,b)-min(r,g,b)>27:continue
        pix[x,y]=(r,g,b,0);q.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
    save(tile.resize((192,192),Image.Resampling.LANCZOS),'art',f'charm-{id}.png')
print('Prepared 36 beads, 12 charms and clean DIY stage from supplied references')
