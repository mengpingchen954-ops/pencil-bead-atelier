"""Extract grandma's keepsake illustration and ornamental corners, never fixed UI."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
import json, sys, uuid

source=Path(sys.argv[1])
out=Path(__file__).resolve().parents[1]/'assets/resources/art'
image=ImageOps.contain(Image.open(source).convert('RGB'),(720,1400),Image.Resampling.LANCZOS)
manifest_path=out/'pencil-sources.json'
manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
def save(im,name,description):
    target=out/name
    im.save(target,**({'quality':94,'optimize':True} if name.endswith('.jpg') else {'optimize':True}))
    meta_path=Path(str(target)+'.meta')
    template='pencil-handover.jpg.meta' if name.endswith('.jpg') else 'pencil-frame.png.meta'
    meta=json.loads((meta_path if meta_path.exists() else out/template).read_text(encoding='utf-8'))
    asset_id=meta['uuid'] if meta_path.exists() else str(uuid.uuid4())
    meta['uuid']=asset_id
    for key,sub in meta['subMetas'].items():
        sub['uuid']=asset_id+'@'+key;sub['displayName']=target.stem
        data=sub['userData'];data['imageUuidOrDatabaseUri']=asset_id+('@6c48a' if key=='f9941' else '')
        if key=='f9941':
            data.update(trimType='none',trimX=0,trimY=0,offsetX=0,offsetY=0,width=im.width,height=im.height,rawWidth=im.width,rawHeight=im.height)
            data.pop('vertices',None)
    meta['userData'].update(redirect=asset_id+'@f9941')
    meta_path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    manifest['assets']=[a for a in manifest['assets'] if a['asset']!=name]
    manifest['assets'].append(dict(asset=name,source=source.name,method=description))
save(image.crop((60,145,660,588)),'pencil-memory-grandma.jpg','Proportion-preserved keepsake illustration only, with no fixed title, relationship or biography')
frame=image.crop((0,0,720,1280)).convert('RGBA')
mask=Image.new('L',frame.size);draw=ImageDraw.Draw(mask)
for points in [[(0,0),(218,0),(209,70),(146,167),(0,233)],[(545,0),(720,0),(720,222),(663,162),(672,45),(545,45)],[(0,1050),(40,1050),(40,1110),(95,1160),(200,1210),(220,1280),(0,1280)],[(720,1110),(686,1110),(650,1210),(605,1280),(720,1280)]]:
    draw.polygon(points,fill=255)
frame.putalpha(mask)
save(frame,'pencil-memory-frame.png','Transparent floral and gold corners only; all character, relationship, history, order and button UI is native')
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Prepared memory illustration and frame')
