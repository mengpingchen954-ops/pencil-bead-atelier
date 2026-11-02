"""Extract blank album frames and floral ornaments; all works, progress and controls are native UI."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFilter
import json, sys, uuid

source=Path(sys.argv[1])
out=Path(__file__).resolve().parents[1]/'assets/resources/art'
art=ImageOps.contain(Image.open(source).convert('RGB'),(720,1290),Image.Resampling.LANCZOS)
manifest_path=out/'pencil-sources.json'
manifest=json.loads(manifest_path.read_text(encoding='utf-8'))

def paper(size):
    tile=art.crop((66,121,130,190))
    result=Image.new('RGB',size)
    for y in range(0,size[1],tile.height):
        for x in range(0,size[0],tile.width):
            result.paste(ImageOps.mirror(tile) if (x//tile.width+y//tile.height)%2 else tile,(x,y))
    return result

def save(im,name,description):
    target=out/name
    im.save(target,**({'quality':94,'optimize':True} if name.endswith('.jpg') else {'optimize':True}))
    path=Path(str(target)+'.meta')
    meta=json.loads((path if path.exists() else out/'pencil-frame.png.meta').read_text(encoding='utf-8'))
    asset_id=meta['uuid'] if path.exists() else str(uuid.uuid4())
    meta.update(uuid=asset_id,files=['.json',target.suffix])
    for key,sub in meta['subMetas'].items():
        sub.update(uuid=asset_id+'@'+key,displayName=target.stem)
        data=sub['userData'];data['imageUuidOrDatabaseUri']=asset_id+('@6c48a' if key=='f9941' else '')
        if key=='f9941':
            data.update(trimType='none',trimX=0,trimY=0,offsetX=0,offsetY=0,width=im.width,height=im.height,rawWidth=im.width,rawHeight=im.height)
            data.pop('vertices',None)
    meta['userData'].update(hasAlpha=im.mode=='RGBA',redirect=asset_id+'@f9941')
    path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    manifest['assets']=[a for a in manifest['assets'] if a['asset']!=name]
    manifest['assets'].append(dict(asset=name,source=source.name,method=description))

# Keep the outside gold frame, lace and flowers. Clear every sample control/card.
background=paper(art.size)
mask=Image.new('L',art.size)
ImageDraw.Draw(mask).polygon([(0,0),(105,0),(104,60),(70,88),(51,160),(51,914),(60,980),(105,1018),(191,1048),(190,1084),(0,1084)],fill=255)
background=Image.composite(art,background,mask)
background=Image.composite(ImageOps.mirror(art),background,ImageOps.mirror(mask))
background.paste(art.crop((0,0,720,54)),(0,0))
background.paste(ImageOps.flip(art.crop((191,13,529,45))),(191,1051))
save(background,'pencil-album-frame.jpg','Gold floral/lace album border and paper; removed sample search, progress, bracelets, locks, CTA, scrollbar and navigation')

card=art.copy()
card.paste(paper((211,208)),(390,518))
save(card.crop((370,498,618,742)),'pencil-album-card.jpg','Blank framed collectible card, with sample bracelet silhouette, lock and uncollected text removed')

flower=art.crop((296,222,354,280)).convert('RGBA')
mask=Image.new('L',flower.size)
ImageDraw.Draw(mask).polygon([(28,2),(39,1),(45,15),(56,20),(57,31),(47,39),(47,51),(36,57),(26,49),(15,55),(5,46),(10,34),(1,26),(6,16),(20,15)],fill=255)
flower.putalpha(mask.filter(ImageFilter.GaussianBlur(.6)))
save(flower,'pencil-album-flower.png','Decorative flower cutout without baked new-unlock label')

grandma=art.crop((520,900,720,1121)).convert('RGBA')
mask=Image.new('L',grandma.size)
ImageDraw.Draw(mask).polygon([(86,0),(128,0),(155,20),(167,57),(159,88),(174,120),(200,137),(200,245),(0,245),(11,224),(35,210),(37,178),(60,157),(56,113),(70,88),(64,57),(69,25)],fill=255)
grandma.putalpha(mask.filter(ImageFilter.GaussianBlur(1)))
save(grandma,'pencil-album-grandma.png','Grandmother companion cutout; no example album state or navigation')
for name,bounds in [('shop',(22,1132,158,1234)),('works',(218,1125,347,1240)),('orders',(393,1123,526,1237)),('journal',(565,1123,705,1241))]:
    save(art.crop(bounds),'pencil-album-nav-'+name+'.jpg','Navigation illustration only; label and touch action drawn natively')
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Prepared blank album frame, card, flower and grandmother')
