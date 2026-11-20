"""Keep the supplied competition paintings; labels, requirements and states stay live."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import json, uuid

root = Path(__file__).resolve().parents[1]
folder = root / 'assets/resources/art'
source = Image.open(root / 'source-art/contest-reference.png').convert('RGB')
assert source.size == (1520,2720)
stage = source.copy()

def patch(box,sample):
    tile=source.crop(sample).resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.BICUBIC)
    layer=stage.copy();layer.paste(tile,box[:2])
    mask=Image.new('L',source.size);ImageDraw.Draw(mask).rectangle(box,fill=255)
    stage.paste(Image.composite(layer,stage,mask.filter(ImageFilter.GaussianBlur(2))))

for box,sample in [
    ((72,245,779,290),(75,213,780,230)),
    ((70,331,872,408),(75,413,860,435)),
    ((69,475,1168,535),(75,548,1110,565)),
    ((209,650,1305,711),(230,716,1290,736)),
    ((490,846,1038,919),(490,923,1040,944)),
    ((420,951,1345,1009),(430,1014,1340,1031)),
    ((410,1035,1330,1094),(430,1100,1320,1115)),
    ((436,1151,918,1215),(423,1156,434,1205)),
    ((1052,1150,1379,1212),(1013,1156,1040,1203)),
    ((497,1340,1023,1415),(500,1418,1030,1437)),
    ((420,1449,1338,1511),(430,1517,1325,1531)),
    ((409,1537,1297,1603),(425,1609,1300,1625)),
    ((434,1652,930,1718),(422,1652,432,1711)),
    ((1095,1651,1320,1714),(1040,1654,1080,1718)),
    ((500,1843,1035,1916),(505,1920,1035,1936)),
    ((420,1953,1338,2018),(425,2020,1330,2034)),
    ((417,2040,1330,2112),(425,2115,1320,2130)),
    ((435,2158,930,2219),(423,2160,433,2210)),
    ((1108,2156,1310,2216),(1034,2155,1090,2220)),
    ((318,2311,1220,2368),(320,2373,1210,2390)),
]: patch(box,sample)

image=stage.crop((0,175,1520,2405)).resize((720,1056),Image.Resampling.LANCZOS)
target=folder/'pencil-contest-background.jpg';image.save(target,quality=94,optimize=True)
path=Path(str(target)+'.meta')
data=json.loads((path if path.exists() else folder/'pencil-diy-stage.jpg.meta').read_text(encoding='utf-8'))
asset_id=data['uuid'] if path.exists() else str(uuid.uuid4())
data.update(uuid=asset_id,files=['.json','.jpg'])
for key,sub in data['subMetas'].items():
    sub.update(uuid=asset_id+'@'+key,displayName=target.stem)
    sub['userData']['imageUuidOrDatabaseUri']=asset_id+('@6c48a' if key=='f9941' else '')
    if key=='f9941':
        sub['userData'].update(trimType='none',trimX=0,trimY=0,offsetX=0,offsetY=0,width=720,height=1056,rawWidth=720,rawHeight=1056)
        sub['userData'].pop('vertices',None)
data['userData'].update(hasAlpha=False,redirect=asset_id+'@f9941')
path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Prepared competition page without sample progress')
