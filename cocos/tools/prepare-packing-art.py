"""Keep only reference illustrations; the bracelet, copy and controls are live Cocos UI."""
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
    record=next((a for a in manifest['assets'] if a['asset']==name),None)
    if record is None:
        record={}
        manifest['assets'].append(record)
    record.update(asset=name,source=source.name,method=description)

# Replace the reference's example jewellery with blank cushion sampled from its lid.
cushion=art.copy()
cushion.paste(art.crop((263,260,450,329)).resize((270,200),Image.Resampling.BICUBIC),(225,367))
mask=Image.new('L',art.size)
ImageDraw.Draw(mask).polygon([(265,373),(456,373),(485,410),(494,545),(473,558),(240,558),(229,544),(239,410)],fill=255)
clean=Image.composite(cushion,art,mask.filter(ImageFilter.GaussianBlur(2)))
box=clean.crop((42,137,678,674))
# Remove ornaments clipped by the original crop, retaining the box, ribbon and watercolor.
for region,sample in [((0,0,29,47),(35,0,85,65)),((523,0,636,96),(473,0,515,68))]:
    patch=box.copy()
    patch.paste(box.crop(sample).resize((region[2]-region[0],region[3]-region[1]),Image.Resampling.BICUBIC),region[:2])
    mask=Image.new('L',box.size)
    ImageDraw.Draw(mask).rectangle(region,fill=255)
    box=Image.composite(patch,box,mask.filter(ImageFilter.GaussianBlur(2)))
save(box,'pencil-packing-box.jpg','Proportion-preserved open box, ribbon and blank cushion; clipped corner ornaments removed; actual jewelry rendered natively within the cushion')
people=art.crop((0,674,720,1050)).convert('RGBA')
mask=Image.new('L',people.size);draw=ImageDraw.Draw(mask)
draw.polygon([(102,14),(150,18),(188,42),(207,78),(210,134),(196,174),(192,205),(218,242),(237,295),(255,359),(227,376),(15,376),(6,350),(10,279),(17,228),(28,198),(31,151),(28,117),(39,61),(70,24)],fill=255)
draw.polygon([(608,5),(650,6),(685,40),(697,84),(686,129),(673,165),(688,197),(720,222),(720,376),(463,376),(470,304),(484,252),(516,212),(532,186),(525,147),(521,111),(531,58),(560,27)],fill=255)
people.putalpha(mask.filter(ImageFilter.GaussianBlur(2)))
save(people,'pencil-packing-people.png','Only heroine and grandma cutouts; no baked blessing heading, text, or controls')
save(art.crop((223,758,498,941)),'pencil-packing-card.jpg','Blank floral blessing card illustration; message and choices are live labels')
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Prepared blank gift box, companions and blessing card')
