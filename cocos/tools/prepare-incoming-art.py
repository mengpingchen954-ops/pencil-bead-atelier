"""Separate incoming-order illustration from example text, controls and material requirements."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFilter
import json, sys, uuid

source=Path(sys.argv[1])
out=Path(__file__).resolve().parents[1]/'assets/resources/art'
art=ImageOps.contain(Image.open(source).convert('RGB'),(720,1290),Image.Resampling.LANCZOS)
manifest_path=out/'pencil-sources.json'
manifest=json.loads(manifest_path.read_text(encoding='utf-8'))

def patch(image,bounds,sample):
    width,height=bounds[2]-bounds[0],bounds[3]-bounds[1]
    tile=art.crop(sample)
    tile=tile.resize((width,max(1,round(tile.height*width/tile.width))),Image.Resampling.LANCZOS)
    texture=Image.new('RGB',(width,height))
    for y in range(0,height,tile.height):texture.paste(tile if y//tile.height%2==0 else ImageOps.flip(tile),(0,y))
    result=image.copy();result.paste(texture,bounds)
    mask=Image.new('L',art.size);ImageDraw.Draw(mask).rectangle(bounds,fill=255)
    return Image.composite(result,image,mask.filter(ImageFilter.GaussianBlur(2)))

def save(image,name,method):
    target=out/name
    image.save(target,**({'quality':94,'optimize':True} if name.endswith('.jpg') else {'optimize':True}))
    path=Path(str(target)+'.meta')
    meta=json.loads((path if path.exists() else out/'pencil-frame.png.meta').read_text(encoding='utf-8'))
    asset_id=meta['uuid'] if path.exists() else str(uuid.uuid4())
    meta.update(uuid=asset_id,files=['.json',target.suffix])
    for key,sub in meta['subMetas'].items():
        sub.update(uuid=asset_id+'@'+key,displayName=target.stem)
        data=sub['userData'];data['imageUuidOrDatabaseUri']=asset_id+('@6c48a' if key=='f9941' else '')
        if key=='f9941':
            data.update(trimType='none',trimX=0,trimY=0,offsetX=0,offsetY=0,width=image.width,height=image.height,rawWidth=image.width,rawHeight=image.height)
            data.pop('vertices',None)
    meta['userData'].update(hasAlpha=image.mode=='RGBA',redirect=asset_id+'@f9941')
    path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    manifest['assets']=[a for a in manifest['assets'] if a['asset']!=name]
    manifest['assets'].append(dict(asset=name,source=source.name,method=method))

room=patch(art,(556,38,690,87),(290,42,533,83))
wall=room.copy()
wall.paste(art.crop((263,122,518,151)).resize((574,201),Image.Resampling.LANCZOS),(72,125))
mask=Image.new('L',art.size);ImageDraw.Draw(mask).rectangle((72,125,646,326),fill=255)
room=Image.composite(wall,room,mask.filter(ImageFilter.GaussianBlur(8)))
room=patch(room,(172,353,550,944),(41,326,170,945))
room.paste(art.crop((602,744,647,867)),(550,744))
room=patch(room,(215,1020,505,1112),(38,1020,211,1112))
save(room,'pencil-incoming-room.jpg','Decorative jewellery cabinet and lace borders; removed example tutorial, portraits, order card, pointing hand and start/skip controls')
card=patch(art,(190,378,531,920),(198,455,238,528))
card.paste(ImageOps.mirror(art.crop((174,741,188,875))),(531,741))
save(card.crop((174,361,545,938)),'pencil-incoming-card.jpg','Blank gold-framed order paper, no example portrait, material icons/counts, title or tutorial hand')
save(art.crop((250,440,466,692)),'pencil-incoming-heroine.jpg','Proportion-preserved framed heroine illustration, shown as Ah He planning the commission rather than a customer portrait')
grandma=art.crop((92,133,261,305)).convert('RGBA')
mask=Image.new('L',grandma.size);ImageDraw.Draw(mask).ellipse((1,1,168,171),fill=255);grandma.putalpha(mask.filter(ImageFilter.GaussianBlur(.6)))
save(grandma,'pencil-incoming-grandma.png','Grandmother tutorial portrait cutout without baked speech or controls')
hand=art.crop((490,744,595,867)).convert('RGBA')
mask=Image.new('L',hand.size);ImageDraw.Draw(mask).polygon([(2,0),(11,0),(22,15),(34,34),(43,36),(51,45),(61,43),(73,52),(82,56),(86,71),(92,99),(104,112),(79,122),(57,112),(37,99),(24,82),(17,65),(18,52),(11,35),(4,17)],fill=255);hand.putalpha(mask.filter(ImageFilter.GaussianBlur(.7)))
save(hand,'pencil-incoming-hand.png','Tutorial pointing hand only; used over a real clickable order card and hidden when guidance is skipped')
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Prepared incoming-order cabinet, blank card, heroine, grandma and tutorial hand')
