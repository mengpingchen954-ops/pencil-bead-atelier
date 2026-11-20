"""Isolate the supplied framed preview; artwork and names are rendered from saves."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageOps
import json, uuid

root = Path(__file__).resolve().parents[1]
folder = root / 'assets/resources/art'
source = Image.open(root / 'source-art/work-preview-reference.png').convert('RGB')
assert source.size == (1520, 2720)
panel = source.copy()
texture = source.crop((640,1020,900,1180))
paper = Image.new('RGB', source.size)
for y in range(0,paper.height,texture.height):
    for x in range(0,paper.width,texture.width):
        tile = ImageOps.mirror(texture) if (x//texture.width+y//texture.height)%2 else texture
        paper.paste(tile,(x,y))
mask = Image.new('L', source.size)
draw = ImageDraw.Draw(mask)
draw.ellipse((327,722,1196,1568),fill=255)
draw.rectangle((237,536,801,679),fill=255)
panel = Image.composite(paper,panel,mask.filter(ImageFilter.GaussianBlur(7)))
for box,sample in [((619,1663,911,1732),(925,1663,975,1732)),((604,1899,930,1990),(949,1900,999,1988))]:
    panel.paste(source.crop(sample).resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.BICUBIC),box[:2])
panel = panel.crop((124,469,1397,2259)).resize((604,849),Image.Resampling.LANCZOS).convert('RGBA')
alpha = Image.new('L',panel.size)
ImageDraw.Draw(alpha).rounded_rectangle((0,0,603,848),radius=29,fill=255)
panel.putalpha(alpha.filter(ImageFilter.GaussianBlur(.5)))
target = folder / 'pencil-work-preview-panel.png'
panel.save(target,optimize=True)
path = Path(str(target)+'.meta')
data = json.loads((path if path.exists() else folder/'pencil-frame.png.meta').read_text(encoding='utf-8'))
asset_id = data['uuid'] if path.exists() else str(uuid.uuid4())
data.update(uuid=asset_id,files=['.json','.png'])
for key,sub in data['subMetas'].items():
    sub.update(uuid=asset_id+'@'+key,displayName=target.stem)
    sub['userData']['imageUuidOrDatabaseUri'] = asset_id+('@6c48a' if key=='f9941' else '')
    if key=='f9941':
        sub['userData'].update(trimType='none',trimX=0,trimY=0,offsetX=0,offsetY=0,width=604,height=849,rawWidth=604,rawHeight=849)
        sub['userData'].pop('vertices',None)
data['userData'].update(hasAlpha=True,redirect=asset_id+'@f9941')
path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Prepared blank floral work preview panel')
