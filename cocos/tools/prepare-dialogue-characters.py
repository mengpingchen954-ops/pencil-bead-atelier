"""Separate the two existing dialogue portraits without changing their registration."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import json, uuid

out=Path(__file__).resolve().parents[1]/'assets/resources/art'
source=out/'pencil-dialogue-stage.jpg'
art=Image.open(source).convert('RGBA')
assert art.size==(720,930)
silhouettes={
    'ahe':[(159,458),(196,457),(232,464),(255,481),(267,506),(269,535),(262,559),(256,581),(256,605),(248,629),(235,648),(220,658),(218,673),(243,683),(266,698),(279,725),(288,764),(300,803),(302,834),(297,856),(291,866),(297,901),(305,930),(88,930),(77,907),(66,883),(54,856),(45,834),(43,805),(45,769),(49,738),(55,716),(67,697),(84,683),(86,669),(77,647),(71,622),(69,595),(73,564),(78,530),(88,504),(104,483),(127,468)],
    'grandma':[(548,453),(570,448),(588,452),(604,463),(614,478),(618,494),(617,505),(612,513),(603,517),(603,533),(607,550),(609,565),(604,578),(603,590),(597,602),(587,613),(576,619),(583,626),(582,633),(575,631),(575,639),(593,648),(614,660),(638,675),(657,695),(674,720),(686,757),(696,805),(704,854),(706,888),(702,915),(694,930),(445,930),(446,907),(433,914),(416,918),(399,916),(381,905),(366,886),(355,858),(350,835),(350,818),(353,808),(348,797),(346,791),(352,785),(337,773),(326,762),(317,749),(311,737),(307,725),(305,714),(305,708),(301,700),(303,694),(310,693),(317,697),(335,710),(349,718),(352,721),(352,710),(350,704),(353,698),(358,697),(363,703),(368,717),(376,729),(384,740),(390,754),(392,770),(397,781),(404,793),(411,770),(418,745),(428,721),(441,701),(458,685),(478,671),(488,665),(478,657),(465,651),(454,639),(445,621),(439,604),(431,599),(428,591),(433,586),(443,582),(438,570),(435,550),(433,531),(435,515),(443,500),(456,485),(475,474),(498,467),(523,462),(540,463),(541,457)],
}
manifest_path=out/'pencil-sources.json'
manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
for name,points in silhouettes.items():
    mask=Image.new('L',art.size)
    ImageDraw.Draw(mask).polygon(points,fill=255)
    layer=art.copy();layer.putalpha(mask.filter(ImageFilter.GaussianBlur(.65)))
    target=out/f'pencil-dialogue-{name}.png';layer.save(target,optimize=True)
    meta_path=Path(str(target)+'.meta')
    meta=json.loads((meta_path if meta_path.exists() else out/'pencil-incoming-grandma.png.meta').read_text(encoding='utf-8'))
    asset_id=meta['uuid'] if meta_path.exists() else str(uuid.uuid4())
    meta['uuid']=asset_id;meta['files']=['.json','.png']
    for key,sub in meta['subMetas'].items():
        sub['uuid']=asset_id+'@'+key;sub['displayName']=target.stem
        data=sub['userData'];data['imageUuidOrDatabaseUri']=asset_id+('@6c48a' if key=='f9941' else '')
        if key=='f9941':
            data.update(trimType='none',trimX=0,trimY=0,offsetX=0,offsetY=0,width=720,height=930,rawWidth=720,rawHeight=930)
            data.pop('vertices',None)
    meta['userData'].update(hasAlpha=True,redirect=asset_id+'@f9941')
    meta_path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    manifest['assets']=[a for a in manifest['assets'] if a['asset']!=target.name]
    manifest['assets'].append(dict(asset=target.name,source=source.name,method='Registered transparent '+name+' silhouette from the existing dialogue art; native Sprite tint dims only this character when not speaking'))
    assert layer.getpixel((180,592) if name=='ahe' else (513,587))[3]==255
    assert layer.getpixel((360,400))[3]==0
    print('Prepared',target.name)
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
