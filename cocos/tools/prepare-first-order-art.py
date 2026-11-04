"""Separate the supplied first-order reference into a clean stage, paper and Lin portrait."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFilter
import json, sys, uuid

source=Path(sys.argv[1])
out=Path(__file__).resolve().parents[1]/'assets/resources/art'
art=ImageOps.contain(Image.open(source).convert('RGB'),(720,1290),Image.Resampling.LANCZOS).crop((0,0,720,1280))
manifest_path=out/'pencil-sources.json'
manifest=json.loads(manifest_path.read_text(encoding='utf-8'))

def save(image,name,method,borders=(0,0,0,0)):
    target=out/name
    image.save(target,**({'quality':94,'optimize':True} if target.suffix=='.jpg' else {'optimize':True}))
    path=Path(str(target)+'.meta')
    meta=json.loads((path if path.exists() else out/'pencil-ui-panel.jpg.meta').read_text(encoding='utf-8'))
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

# Use only the unoccupied upper room. A closer window view leaves genuine empty
# space behind the one live portrait, without retaining either baked character.
room=art.crop((272,315,414,615))
stage=art.copy()
stage.paste(ImageOps.fit(room,(720,810),Image.Resampling.LANCZOS),(0,115))
stage.paste(art.crop((0,0,720,115)),(0,0))
# Erase the reference's fixed top-right controls using nearby paper texture.
stage.paste(art.crop((525,5,540,115)).resize((178,110),Image.Resampling.LANCZOS),(542,5))
# Retain the illustrated plaque but clear its sample title for the native Label.
sign=art.crop((188,230,525,316))
sign.paste(sign.crop((23,27,45,61)).resize((226,42),Image.Resampling.LANCZOS),(55,23))
sign_mask=Image.new('L',sign.size)
ImageDraw.Draw(sign_mask).polygon([(32,0),(300,0),(316,8),(320,17),(329,21),(336,31),(336,56),(328,68),(316,72),(311,82),(301,85),(30,85),(18,80),(14,72),(3,64),(0,53),(0,33),(6,20),(15,16),(20,6)],fill=255)
stage.paste(sign,(188,230),sign_mask.filter(ImageFilter.GaussianBlur(.4)))
paper=art.crop((55,980,105,1020)).resize((720,355),Image.Resampling.LANCZOS)
stage.paste(paper,(0,925))
# Preserve the supplied lower watercolour and flower corners, outside its old card.
stage.paste(art.crop((0,1153,720,1280)),(0,1153))
save(stage,'pencil-first-order-stage.jpg','Unoccupied upper reference room reframed as a close window backdrop; original flower/header/plaque/footer preserved, both baked people and all fixed UI removed')

# The paper card is a native sliced surface: all names, dialogue and actions stay live.
panel=art.crop((36,842,683,1152))
blank=art.crop((65,977,115,1020))
panel.paste(blank.resize((595,263),Image.Resampling.LANCZOS),(24,22))
# Keep the original top-right paper flower and thin lining.
panel.paste(art.crop((600,870,648,919)),(564,28))
save(panel,'pencil-first-order-panel.jpg','Blank floral dialogue paper with no baked speaker, line, tutorial hint or button',(25,25,23,25))

# Trace the supplied customer silhouette; the other person never enters this layer.
points=[(409,324),(437,327),(462,340),(483,363),(493,390),(498,417),(494,445),(480,462),(474,468),(478,480),(498,487),(516,502),(532,520),(543,546),(553,573),(565,600),(568,624),(566,649),(559,672),(308,672),(293,658),(284,645),(282,631),(285,617),(290,607),(286,582),(283,560),(282,551),(269,546),(255,539),(246,532),(239,522),(233,512),(232,507),(236,505),(240,507),(246,510),(242,505),(237,502),(239,499),(246,502),(256,508),(267,515),(278,521),(282,521),(277,515),(273,508),(272,503),(275,499),(281,502),(293,513),(301,522),(305,534),(309,554),(313,577),(319,600),(324,591),(325,568),(329,545),(335,522),(338,507),(352,489),(369,480),(364,471),(355,462),(349,452),(344,445),(341,435),(341,422),(343,411),(346,400),(348,386),(354,371),(362,354),(378,338),(393,329)]
mask=Image.new('L',art.size)
ImageDraw.Draw(mask).polygon([(round(x*720/572),round(y*720/572)) for x,y in points],fill=255)
portrait=art.convert('RGBA');portrait.putalpha(mask.filter(ImageFilter.GaussianBlur(.6)))
portrait=portrait.crop((286,405,716,843))
assert portrait.getpixel((235,140))[3]==255
assert portrait.getpixel((5,5))[3]==0
save(portrait,'pencil-dialogue-lin.png','Only Lin Auntie from the supplied first-order reference, feathered transparent silhouette; displayed alone while she speaks')
# Ah He's reference portrait is independently switchable, never baked into the scene.
points=[(140,329),(165,331),(185,339),(199,349),(208,365),(211,385),(208,405),(200,424),(198,446),(192,461),(181,474),(180,489),(198,496),(215,508),(224,526),(231,554),(237,586),(240,612),(235,631),(236,650),(241,672),(57,672),(49,654),(45,631),(44,604),(48,578),(47,554),(50,536),(57,520),(69,510),(78,499),(81,487),(78,473),(69,461),(65,441),(65,420),(69,400),(71,378),(80,358),(96,342),(116,332)]
mask=Image.new('L',art.size)
ImageDraw.Draw(mask).polygon([(round(x*720/572),round(y*720/572)) for x,y in points],fill=255)
portrait=art.convert('RGBA');portrait.putalpha(mask.filter(ImageFilter.GaussianBlur(.6)))
portrait=portrait.crop((53,411,306,844))
save(portrait,'pencil-speaker-ahe.png','Independent transparent Ah He portrait from the first-order reference; shown only for her own lines')
grandma=Image.open(out/'pencil-dialogue-grandma.png').convert('RGBA')
grandma=grandma.crop(grandma.getchannel('A').getbbox())
save(grandma,'pencil-speaker-grandma.png','Cropped registered grandmother cutout from existing pencil-dialogue-grandma.png, shown only for her own lines')
next(a for a in manifest['assets'] if a['asset']=='pencil-speaker-grandma.png')['source']='pencil-dialogue-grandma.png'
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Prepared clean first-order stage, blank sliced paper and three independent speaker portraits')
