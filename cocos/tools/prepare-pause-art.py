"""Keep the reference's floral paper and blank button; all state and input are native."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFilter
import json, sys, uuid

source = Path(sys.argv[1])
out = Path(__file__).resolve().parents[1]/'assets/resources/art'
art = ImageOps.contain(Image.open(source).convert('RGB'), (720,1290), Image.Resampling.LANCZOS)
manifest_path = out/'pencil-sources.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))

def blank(image, bounds, sample):
    patch = image.copy()
    width,height=bounds[2]-bounds[0],bounds[3]-bounds[1]
    tile=art.crop(sample)
    tile=tile.resize((width,round(tile.height*width/tile.width)),Image.Resampling.LANCZOS)
    texture=Image.new('RGB',(width,height))
    for y in range(0,height,tile.height):
        texture.paste(tile if y//tile.height%2==0 else ImageOps.flip(tile),(0,y))
    patch.paste(texture,bounds)
    mask = Image.new('L',image.size)
    ImageDraw.Draw(mask).rectangle(bounds,fill=255)
    return Image.composite(patch,image,mask.filter(ImageFilter.GaussianBlur(1)))

def save(image,name,method):
    target = out/name
    image.save(target,optimize=True)
    path = Path(str(target)+'.meta')
    meta = json.loads((path if path.exists() else out/'pencil-frame.png.meta').read_text(encoding='utf-8'))
    asset_id = meta['uuid'] if path.exists() else str(uuid.uuid4())
    meta.update(uuid=asset_id,files=['.json','.png'])
    for key,sub in meta['subMetas'].items():
        sub.update(uuid=asset_id+'@'+key,displayName=target.stem)
        data=sub['userData'];data['imageUuidOrDatabaseUri']=asset_id+('@6c48a' if key=='f9941' else '')
        if key=='f9941':
            data.update(trimType='none',trimX=0,trimY=0,offsetX=0,offsetY=0,width=image.width,height=image.height,rawWidth=image.width,rawHeight=image.height)
            data.pop('vertices',None)
    meta['userData'].update(hasAlpha=True,redirect=asset_id+'@f9941')
    path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    manifest['assets']=[a for a in manifest['assets'] if a['asset']!=name]
    manifest['assets'].append(dict(asset=name,source=source.name,method=method))

panel=blank(art,(258,305,462,368),(264,392,458,410))
panel=blank(panel,(183,411,542,641),(147,642,576,668))
panel=blank(panel,(153,675,566,786),(147,642,576,668))
panel=blank(panel,(132,802,589,915),(147,642,576,668))
mask=Image.new('L',art.size)
ImageDraw.Draw(mask).polygon([(45,271),(64,233),(112,202),(165,184),(206,206),(241,235),(269,224),(322,211),(355,195),(386,213),(436,229),(463,215),(520,214),(582,250),(627,268),(637,299),(669,317),(670,377),(644,411),(635,714),(664,748),(676,815),(664,867),(679,913),(667,970),(636,1016),(568,1038),(485,1042),(445,1027),(402,1048),(367,1040),(340,1024),(291,1030),(245,1018),(193,1025),(147,1007),(104,1018),(71,987),(56,931),(59,873),(72,827),(89,794),(86,501),(57,471),(35,438),(42,405),(27,378),(45,349)],fill=255)
panel=panel.convert('RGBA');panel.putalpha(mask.filter(ImageFilter.GaussianBlur(1)))
save(panel.crop((24,182,684,1050)),'pencil-pause-panel.png','Proportion-preserved floral paper, lace and crown cutout; removed title, example toggles, action buttons, check badges and all example game state')
button=blank(art,(261,699,463,762),(203,701,253,758)).crop((156,680,563,783)).convert('RGBA')
mask=Image.new('L',button.size);ImageDraw.Draw(mask).polygon([(1,39),(14,23),(23,15),(30,1),(372,1),(381,14),(393,22),(406,40),(406,65),(397,81),(383,90),(375,101),(28,101),(19,91),(8,81),(1,64)],fill=255)
button.putalpha(mask.filter(ImageFilter.GaussianBlur(.6)))
save(button,'pencil-pause-button.png','Blank green and gold action plate; lettering removed, used for live native actions')
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Prepared blank floral pause panel and action plate')
