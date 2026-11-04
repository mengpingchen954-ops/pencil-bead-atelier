"""Prepare the supplied shop home and reusable painted UI without sample save data."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFilter
import json, sys, uuid

source=Path(sys.argv[1])
out=Path(__file__).resolve().parents[1]/'assets/resources/art'
art=ImageOps.contain(Image.open(source).convert('RGB'),(1140,2040),Image.Resampling.LANCZOS)
scale=art.width/715
def bounds(rect): return tuple(round(n*scale) for n in rect)
def patch(image,rect,sample):
    box=bounds(rect);tile=art.crop(bounds(sample));w,h=box[2]-box[0],box[3]-box[1]
    tile=tile.resize((w,max(1,round(tile.height*w/tile.width))),Image.Resampling.LANCZOS)
    texture=Image.new('RGB',(w,h))
    for y in range(0,h,tile.height):texture.paste(tile if y//tile.height%2==0 else ImageOps.flip(tile),(0,y))
    result=image.copy();result.paste(texture,box)
    mask=Image.new('L',image.size);ImageDraw.Draw(mask).rectangle(box,fill=255)
    return Image.composite(result,image,mask.filter(ImageFilter.GaussianBlur(1.4*scale)))

manifest_path=out/'pencil-sources.json';manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
def save(image,name,method,borders=(0,0,0,0)):
    target=out/name;image.save(target,quality=94,optimize=True)
    path=Path(str(target)+'.meta')
    meta=json.loads((path if path.exists() else out/'pencil-cover.jpg.meta').read_text(encoding='utf-8'))
    asset_id=meta['uuid'] if path.exists() else str(uuid.uuid4())
    meta.update(uuid=asset_id,files=[target.suffix,'.json'])
    for key,sub in meta['subMetas'].items():
        sub.update(uuid=asset_id+'@'+key,displayName=target.stem)
        data=sub['userData'];data['imageUuidOrDatabaseUri']=asset_id+('@6c48a' if key=='f9941' else '')
        if key=='f9941':
            data.update(trimType='none',trimX=0,trimY=0,offsetX=0,offsetY=0,width=image.width,height=image.height,rawWidth=image.width,rawHeight=image.height,
                        borderLeft=borders[0],borderRight=borders[1],borderTop=borders[2],borderBottom=borders[3])
            data.pop('vertices',None)
    meta['userData'].update(hasAlpha=image.mode=='RGBA',redirect=asset_id+'@f9941')
    path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    manifest['assets']=[a for a in manifest['assets'] if a['asset']!=name]
    manifest['assets'].append(dict(asset=name,source=source.name,method=method))

header=art.copy()
for rect,sample in [((76,24,198,61),(77,69,199,79)),((319,25,378,61),(319,19,378,26)),((449,25,508,61),(449,19,508,26)),((578,25,612,62),(578,19,612,26))]:
    header=patch(header,rect,sample)
save(header.crop(bounds((0,0,715,84))),'pencil-ui-header.jpg','Resource header with pearl/coin/heart/settings icons; title, inventory, coins and energy are live native text')
primary=patch(art,(122,834,319,880),(84,832,113,881))
neutral=patch(art,(426,834,625,880),(379,832,406,881))
button=primary.crop(bounds((70,821,347,894)))
pixels=[]
for r,g,b in button.get_flattened_data():
    strength=max(0,min(1,min(g-r,g-b)/8))
    pixels.append(tuple(round(v*(1-.24*strength)) for v in (r,g,b)))
button.putdata(pixels)
def luminance(rgb):
    linear=[v/255/12.92 if v/255<=.04045 else ((v/255+.055)/1.055)**2.4 for v in rgb]
    return sum(v*w for v,w in zip(linear,(.2126,.7152,.0722)))
paper=luminance((250,246,233))
assert min((paper+.05)/(luminance(p)+.05) for p in button.crop((50,32,button.width-32,button.height-30)).get_flattened_data())>=4.5
save(button,'pencil-ui-primary.jpg','Blank sage painted button; green darkened for at least 4.5:1 paper-text contrast in its content area; rounded cream corners retained',(32,32,26,26))
save(neutral.crop(bounds((366,821,651,894))),'pencil-ui-neutral.jpg','Blank cream painted button, no baked icon or action text',(32,32,26,26))
for name,rect,light in [('craft',(124,832,170,881),True),('bag',(428,834,471,881),False)]:
    tile=art.crop(bounds(rect));luma=tile.convert('L')
    mask=luma.point((lambda p:max(0,min(255,round((p-180)*255/55)))) if light else (lambda p:max(0,min(255,round((210-p)*255/100)))))
    icon=Image.new('RGBA',tile.size,'white');icon.putalpha(mask)
    save(icon,'pencil-ui-'+name+'.png','Transparent action icon from the reference; native tint follows the active/neutral button state')
wash=patch(art,(41,1165,110,1256),(35,1194,44,1222))
save(wash.crop(bounds((8,1144,143,1276))),'pencil-ui-active.jpg','Watercolour selection wash, original home icon and text removed')

page=header.copy()
for rect,sample in [
    ((68,650,336,686),(75,687,337,703)),
    ((502,650,615,684),(75,687,437,703)),
    ((68,704,449,752),(75,687,437,703)),
    ((68,763,440,804),(75,687,437,703)),
    ((68,818,654,895),(75,687,437,703)),
    ((43,936,327,969),(45,922,327,936)),
    ((574,936,678,970),(486,922,571,936)),
]:page=patch(page,rect,sample)
save(page,'pencil-home-page.jpg','Supplied home illustration, decorative frame and original watercolour bracelet retained; customer, order, reward, stock status, primary actions and story/chapter progress removed for live native rendering')
panel=patch(page,(67,644,671,904),(75,687,437,703))
save(panel.crop(bounds((21,625,687,916))),'pencil-ui-panel.jpg','Blank floral paper frame for shared dialogs and information cards',(90,48,70,48))
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Prepared live shop home, resource header, painted buttons, selection wash and floral dialog paper')
