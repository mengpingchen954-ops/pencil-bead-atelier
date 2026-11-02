"""Extract story vignettes and floral edges. All route states and controls are native."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFilter
import json, sys, uuid

source=Path(sys.argv[1])
out=Path(__file__).resolve().parents[1]/'assets/resources/art'
art=ImageOps.contain(Image.open(source).convert('RGB'),(720,1291),Image.Resampling.LANCZOS)
manifest_path=out/'pencil-sources.json'
manifest=json.loads(manifest_path.read_text(encoding='utf-8'))

def save(im,name,description):
    target=out/name
    im.save(target,**({'quality':94,'optimize':True} if name.endswith('.jpg') else {'optimize':True}))
    meta_path=Path(str(target)+'.meta')
    template='pencil-handover.jpg.meta' if name.endswith('.jpg') else 'pencil-frame.png.meta'
    meta=json.loads((meta_path if meta_path.exists() else out/template).read_text(encoding='utf-8'))
    asset_id=meta['uuid'] if meta_path.exists() else str(uuid.uuid4())
    meta['uuid']=asset_id;meta['files']=['.json',target.suffix]
    for key,sub in meta['subMetas'].items():
        sub['uuid']=asset_id+'@'+key;sub['displayName']=target.stem
        data=sub['userData'];data['imageUuidOrDatabaseUri']=asset_id+('@6c48a' if key=='f9941' else '')
        if key=='f9941':
            data.update(trimType='none',trimX=0,trimY=0,offsetX=0,offsetY=0,width=im.width,height=im.height,rawWidth=im.width,rawHeight=im.height)
            data.pop('vertices',None)
    meta['userData'].update(hasAlpha=im.mode=='RGBA',redirect=asset_id+'@f9941')
    meta_path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    manifest['assets']=[a for a in manifest['assets'] if a['asset']!=name]
    manifest['assets'].append(dict(asset=name,source=source.name,method=description))

# Remove example locks with adjacent illustration samples before extracting the last two stops.
clean=art.copy()
for box,sample in [((508,826,553,880),(554,826,599,880)),((199,920,240,976),(243,920,284,976))]:
    patch=art.crop(sample);layer=clean.copy();layer.paste(patch,box[:2])
    mask=Image.new('L',art.size);ImageDraw.Draw(mask).rectangle(box,fill=255)
    clean=Image.composite(layer,clean,mask.filter(ImageFilter.GaussianBlur(1)))
for name,box in [('family',(73,190,370,405)),('workshop',(408,363,640,551)),('shop',(85,519,353,720)),('name',(410,733,647,910)),('tomorrow',(86,828,350,1011))]:
    save(clean.crop(box),'pencil-route-'+name+'.jpg','Story illustration only, no chapter plaque or lock; room/market example locks replaced with adjacent illustration samples')
frame=art.convert('RGBA');mask=Image.new('L',art.size);draw=ImageDraw.Draw(mask)
for polygon in [[(0,0),(206,0),(202,75),(137,161),(65,184),(65,1125),(0,1125)],[(514,0),(720,0),(720,1145),(655,1145),(655,190),(604,160),(580,80),(514,65)],[(0,1120),(58,1120),(72,1200),(186,1240),(205,1291),(0,1291)],[(720,1110),(670,1110),(655,1200),(527,1242),(511,1291),(720,1291)]]:
    draw.polygon(polygon,fill=255)
draw.rectangle((0,0,88,89),fill=0);draw.rectangle((550,0,720,77),fill=0)
draw.rectangle((0,1260,720,1291),fill=255)
frame.putalpha(mask)
save(frame,'pencil-route-frame.png','Floral side borders and corners only; gear, currencies and progress controls removed')
banner=art.crop((70,55,638,181))
paper=art.crop((330,60,390,68)).resize(banner.size,Image.Resampling.BICUBIC)
text_mask=Image.new('L',banner.size);ImageDraw.Draw(text_mask).rectangle((92,12,499,72),fill=255)
banner=Image.composite(paper,banner,text_mask.filter(ImageFilter.GaussianBlur(1)))
shape=Image.new('L',banner.size)
ImageDraw.Draw(shape).polygon([(90,15),(188,0),(385,0),(494,17),(491,40),(565,70),(541,89),(560,124),(444,100),(456,79),(379,65),(312,83),(251,73),(196,68),(100,90),(114,105),(5,125),(16,85),(0,66),(87,42)],fill=255)
banner=Image.composite(banner,art.crop((351,185,409,235)).resize(banner.size),shape)
save(banner,'pencil-route-banner.jpg','Reference banner with baked title replaced by sampled blank paper; title rendered natively')
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Prepared five story illustrations, floral frame and blank banner')
