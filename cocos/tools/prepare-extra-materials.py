"""Extract one representative per distinct supplied material; retain original transparent art.
The twelve original sheets stay outside the repository. Existing material IDs 0–47 never move.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps, ImageFilter
import copy, json, uuid
from collections import deque
import numpy as np

root = Path(__file__).resolve().parents[1]
source = Path('E:/Game/手串/UI/珠子')
sheets = ['4040de4947ec095c93d5832ee6b75745','7096c57c8679e74bbad86f40ac11c90b','a43b4457624cd6a029a45e0ab15dd922','dbffe6f23b25b9dddf76fcdd3854ac7c','1b893b002dc8154e96c8a92f1e8e4a1c','04dc20dd4b437e3c64361d1622cc79d4','8d48fb6f9f6a6ec92555f105a7521661','8dd97cd2c40b07c778fe8958b863b24c','9eb067fe788148993db574628f7e2009','82f545d68b0ba04ba09555fedb1eb16f','086d8ef1bca682a1b7d986c46f2b1633','6986c55c948cfb6e4b94364dd6c9db76']
items = []
def bead(sheet, name, category, x, y, radius, **extra):
    items.append(dict(sheet=sheet,name=name,category=category,box=[x-radius,y-radius,x+radius,y+radius],round=True,**extra))
def part(sheet, name, category, box, key=None, hole=None, body=None, **extra):
    items.append(dict(sheet=sheet,name=name,category=category,box=box,round=False,**({'id':key} if key else {}),**({'hole':hole,'body':body} if hole else {}),**extra))

# Pink/white series: repeated sizes, near-identical pink rounds and alternate views are omitted.
bead(0,'虹彩白珍珠',0,360,123,75,pale=True)
bead(0,'雪绒白晶',1,920,125,73,pale=True)
bead(0,'樱云晶',1,1087,320,71,pale=True)
part(0,'蔷薇原石',1,[620,36,836,211],threaded=True,pale=True)
bead(1,'金箔花琉璃',0,118,192,72,pale=True)
bead(1,'紫霞花琉璃',0,267,186,68,pale=True)
bead(1,'红鲤琉璃',0,410,190,67)
bead(1,'碧水红鲤珠',0,565,184,77,pale=True)
bead(1,'琥珀花琉璃',0,709,185,62,pale=True)
bead(1,'浅海金丝珠',0,842,185,63,pale=True)
bead(1,'锦霞琉璃',0,979,184,67)
bead(1,'晴蓝琉璃',0,1127,185,73,pale=True)
bead(1,'奶油花簇珠',0,287,391,75,pale=True)
bead(1,'蓝庭花簇珠',0,506,390,88,pale=True)
bead(1,'蜜金花簇珠',0,729,391,76,pale=True)
bead(1,'朱红琉璃',0,220,575,53)
part(1,'流霞琉璃管',0,[479,991,759,1136],threaded=True)
bead(2,'绢丝粉晶',1,408,180,110,pale=True)
bead(2,'羽绒白晶',1,406,415,110,pale=True)
part(2,'繁花银隔珠',3,[82,1033,282,1186],'new-flower-spacer')
bead(3,'冰裂粉晶',1,1048,232,141,pale=True)
part(3,'花簇银隔珠',3,[60,709,301,858],'new-cluster-spacer')
bead(4,'草莓晶',1,154,267,113)
bead(4,'白兔毛晶',1,395,260,115,pale=True)
bead(4,'黄幽灵',1,626,263,112,pale=True)
bead(4,'粉幽灵',1,861,262,115,pale=True)
bead(4,'金针水晶',1,1104,262,112,pale=True)
bead(4,'白幽灵',1,150,535,115,pale=True)
bead(4,'蓝兔毛晶',1,394,533,114,pale=True)
bead(4,'茶幽灵',1,632,531,111)
bead(4,'金丝晶',1,1103,531,112,pale=True)
bead(4,'粉发晶',1,154,799,112,pale=True)
bead(4,'苔绿玉',0,392,800,112,pale=True)
part(4,'银叶延长链',3,[160,983,775,1140],'new-leaf-chain',[192,1052],[480,1088])
part(4,'银瓣花坠',3,[860,965,1067,1192],'new-silver-flower',[960,990],[961,1085])
part(5,'橄榄切面桶珠',0,[78,82,461,306],threaded=True,pale=True)
part(5,'薄荷切面晶',1,[524,52,736,330],threaded=True,pale=True)
part(5,'金纹隔珠',3,[804,126,928,253],'new-gold-spacer')
bead(5,'孔雀石',0,118,472,102)
bead(5,'葡萄石',1,321,473,96,pale=True)
bead(5,'柠檬晶',1,930,478,103,pale=True)
bead(5,'碧玉',0,1132,470,105)
bead(5,'金绿晶',1,565,708,69,pale=True)
bead(5,'墨绿晶',1,817,715,52)
bead(6,'星屑紫晶',1,300,96,70,pale=True)
bead(6,'金托胭脂珠',0,628,95,75)
bead(6,'虹彩幻晶',1,1111,97,71,pale=True)
bead(6,'金星青金石',0,461,251,65)
bead(6,'银曜石',1,1113,251,67)
bead(6,'金曜石',1,136,386,67)
bead(6,'紫萤石',1,296,385,67,pale=True)
bead(6,'烟紫晶',1,624,384,66)
bead(6,'柠檬发晶',1,465,522,65,pale=True)
bead(6,'蔷薇霜晶',1,115,668,67,pale=True)
bead(6,'金珠',3,72,809,25,id='new-gold-bead')
bead(6,'银珠',3,148,810,26,id='new-silver-bead')
part(6,'金花托',3,[207,775,321,844],'new-gold-flower-cap')
part(6,'银花托',3,[334,774,444,843],'new-silver-flower-cap')
part(6,'镂空银隔珠',3,[456,763,576,852],'new-silver-filigree')
part(6,'镶钻银隔珠',3,[612,775,710,844],'new-silver-diamond-spacer')
part(6,'镂空银球',3,[605,910,768,1046],'new-silver-ball')
part(6,'金铃簇',3,[121,889,281,1079],'new-gold-bells',[205,919],[198,1000])
part(6,'银鱼尾',3,[320,880,452,1052],'new-silver-tail',[365,916],[383,1003])
part(6,'福字银坠',3,[474,888,610,1049],'new-fu',[539,919],[540,996])
part(6,'镂空蝶坠',3,[787,868,1021,1067],'new-filigree-butterfly',[909,942],[907,1018])
part(6,'镶钻长坠',3,[1045,867,1113,1081],'new-silver-taper',[1080,900],[1081,1009])
part(6,'金链节',3,[16,1103,244,1234],'new-gold-chain',[32,1195],[165,1168])
part(6,'龙虾扣',3,[614,1103,705,1206],'new-clasp')
part(6,'连接金环',3,[736,1128,806,1191],'new-gold-jump-ring')
part(6,'如意金结',3,[988,1103,1099,1210],'new-gold-knot',[1043,1130],[1040,1180])
bead(7,'玫瑰红晶',1,1012,410,108)
part(7,'镶钻金隔珠',3,[126,1004,320,1130],'new-gold-diamond-spacer')
part(7,'镶钻心坠',3,[847,962,1127,1205],'new-diamond-heart',[985,990],[985,1095])
bead(8,'烟灰珍珠',0,534,127,56)
bead(8,'虎睛石',1,114,466,80)
bead(8,'斑纹木珠',2,430,474,59)
part(8,'巴洛克珍珠',0,[27,562,157,738],threaded=True,pale=True)
part(8,'香槟切面珠',1,[623,590,730,706],threaded=True,pale=True)
part(8,'双环银隔珠',3,[466,774,574,844],'new-double-spacer')
part(8,'雕花金方珠',3,[955,770,1043,860],'new-gold-cube')
part(8,'金管珠',3,[1065,785,1209,837],'new-gold-tube')
part(8,'满钻银珠',3,[80,881,185,984],'new-pave-ball')
part(9,'苔纹方珠',0,[32,163,129,266],threaded=True,pale=True)
part(9,'金花珍珠坠',3,[492,446,620,590],'new-pearl-flower',[557,462],[556,527])
part(9,'欧泊金坠',3,[626,437,805,609],'new-opal',[716,451],[715,527])
part(9,'竹影金牌',3,[814,433,966,637],'new-bamboo-plaque',[891,448],[889,546])
part(9,'山水玉牌',3,[958,421,1214,659],'new-landscape-jade',[1101,444],[1096,554])
part(9,'幻彩水滴',3,[73,607,156,824],'new-opal-drop',[109,636],[112,756])
part(9,'金链流苏',3,[519,579,662,923],'new-chain-tassel',[581,615],[584,802])
part(9,'金叶扣',3,[911,642,1051,816],'new-leaf-hook',[989,668],[977,754])
part(9,'竹节金环',3,[234,883,447,1082],'new-bamboo-ring')
bead(10,'暖棕木珠',2,398,151,114)
bead(10,'雾蓝玉',0,624,383,112,pale=True)
bead(10,'奶油玉',0,860,383,112,pale=True)
part(10,'浅绿玉桶',0,[132,528,479,764],threaded=True,pale=True)
bead(10,'蜜橙切面晶',1,660,648,124)
part(10,'扁木隔片',2,[863,562,938,745],threaded=True)
part(10,'金纹长牌',3,[289,900,426,1203],'new-gold-plaque',[363,951],[350,1082])
part(10,'金镶绿玉',3,[449,942,908,1214],'new-jade-setting')
bead(11,'紫绢晶',1,300,128,77,pale=True)
bead(11,'透亮白水晶',1,460,130,80,pale=True)
bead(11,'樱屑碎晶',1,634,129,80,pale=True)
bead(11,'葡萄紫晶',1,805,129,80)
bead(11,'冰裂白晶',1,984,133,79,pale=True)
bead(11,'烟茶水晶',1,634,313,80)

template = json.loads((root/'assets/resources/beads/bead-0.png.meta').read_text(encoding='utf-8'))
tones = {}
for tone,names in {
 'white':'虹彩白珍珠 雪绒白晶 奶油花簇珠 羽绒白晶 白兔毛晶 白幽灵 巴洛克珍珠 奶油玉 透亮白水晶 冰裂白晶',
 'pink':'樱云晶 蔷薇原石 绢丝粉晶 冰裂粉晶 粉幽灵 粉发晶 蔷薇霜晶 樱屑碎晶',
 'red':'红鲤琉璃 锦霞琉璃 朱红琉璃 草莓晶 金托胭脂珠 玫瑰红晶',
 'yellow':'琥珀花琉璃 蜜金花簇珠 黄幽灵 金针水晶 金丝晶 柠檬晶 金绿晶 柠檬发晶 香槟切面珠',
 'green':'苔绿玉 橄榄切面桶珠 薄荷切面晶 孔雀石 葡萄石 碧玉 墨绿晶 苔纹方珠 浅绿玉桶',
 'blue':'金箔花琉璃 碧水红鲤珠 浅海金丝珠 晴蓝琉璃 蓝庭花簇珠 蓝兔毛晶 金星青金石 雾蓝玉',
 'purple':'紫霞花琉璃 星屑紫晶 虹彩幻晶 紫萤石 烟紫晶 紫绢晶 葡萄紫晶',
 'brown':'茶幽灵 烟灰珍珠 虎睛石 斑纹木珠 暖棕木珠 扁木隔片 烟茶水晶',
 'black':'银曜石 金曜石','orange':'流霞琉璃管 蜜橙切面晶',
}.items():
    for name in names.split():tones[name]=tone
catalog, records = [], []
counts = [12]*4
for index,item in enumerate(items,48):
    sheet = sheets[item['sheet']]+'.png'
    box = item['box']; image = Image.open(source/sheet).convert('RGBA').crop(box)
    alpha = np.asarray(image.getchannel('A')).astype(float)
    alpha = np.clip((alpha-12)*255/242,0,255).astype('uint8')
    mask = Image.fromarray(alpha)
    if item['round']:
        silhouette = Image.new('L',image.size);ImageDraw.Draw(silhouette).ellipse((1,1,image.width-2,image.height-2),fill=255)
        mask = Image.fromarray(np.minimum(np.asarray(mask),np.asarray(silhouette.filter(ImageFilter.GaussianBlur(.45)))))
    # Discard tiny disconnected slivers from neighboring items at the crop edge.
    if item['round'] or item.get('id')=='new-bamboo-ring':
        a=np.asarray(mask);seen=np.zeros(a.shape,dtype=bool);components=[]
        for yy,xx in np.argwhere(a>64):
            if seen[yy,xx]:continue
            queue=deque([(int(xx),int(yy))]);seen[yy,xx]=True;points=[]
            while queue:
                x,y=queue.popleft();points.append((x,y))
                for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                    if 0<=nx<a.shape[1] and 0<=ny<a.shape[0] and not seen[ny,nx] and a[ny,nx]>64:
                        seen[ny,nx]=True;queue.append((nx,ny))
            components.append(points)
        keep=Image.new('L',mask.size);pixels=keep.load();largest=max(map(len,components),default=0)
        for points in components:
            if len(points)<largest*(1 if item['round'] else .03):continue
            for x,y in points:pixels[x,y]=255
        mask=Image.fromarray(np.minimum(a,np.asarray(keep.filter(ImageFilter.MaxFilter(5)))))
    image.putalpha(mask)
    bounds = mask.point(lambda a:255 if a>60 else 0).getbbox()
    assert bounds, item['name']
    image = image.crop(bounds)
    fit = min(188/image.width,188/image.height)
    dims = (round(image.width*fit),round(image.height*fit));image=image.resize(dims,Image.Resampling.LANCZOS)
    offset = ((192-dims[0])//2,(192-dims[1])//2)
    canvas = Image.new('RGBA',(192,192));canvas.alpha_composite(image,offset)
    name = 'charm-'+item['id'] if item.get('id') else 'bead-'+str(index)
    path = root/'assets/resources'/('art' if item.get('id') else 'beads')/(name+'.png')
    canvas.save(path,optimize=True)
    meta_path=Path(str(path)+'.meta');meta=json.loads(meta_path.read_text(encoding='utf-8')) if meta_path.exists() else copy.deepcopy(template)
    identity=meta['uuid'] if meta_path.exists() else str(uuid.uuid5(uuid.NAMESPACE_URL,'pencil-bead-atelier/extra/'+name))
    meta.update(uuid=identity,files=['.json','.png']);meta['userData'].update(hasAlpha=True,redirect=identity+'@f9941')
    for key,sub in meta['subMetas'].items():
        sub.update(uuid=identity+'@'+key,displayName=name);sub['userData']['imageUuidOrDatabaseUri']=identity+('@6c48a' if key=='f9941' else '')
        if key=='f9941':
            sub['userData'].update(trimType='none',trimX=0,trimY=0,offsetX=0,offsetY=0,width=192,height=192,rawWidth=192,rawHeight=192,borderLeft=0,borderRight=0,borderTop=0,borderBottom=0)
            sub['userData'].pop('vertices',None)
    meta_path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    category=item['category'];entry=dict(name=item['name'],short=item['name'],category=category,cell=counts[category],color=['#d6b0a1','#b1c8cc','#a58160','#d4b676'][category])
    entry['bounds']=[round(v/192,4) for v in canvas.getchannel('A').point(lambda a:255 if a>64 else 0).getbbox()]
    if item.get('id') in ['new-leaf-chain','new-gold-chain','new-clasp']:entry['retired']=True
    entry['tone']=tones.get(item['name'],'metal')
    if item['name'] in ['银曜石','金曜石','金星青金石','墨绿晶','葡萄紫晶','烟茶水晶']:entry['deep']=True
    for key in ['id','pale','threaded']:
        if key in item:entry[key]=item[key]
    if item.get('hole'):
        def point(p):return [round(offset[0]+(p[0]-box[0]-bounds[0])*fit,2),round(offset[1]+(p[1]-box[1]-bounds[1])*fit,2)]
        entry['attachment']=point(item['hole'])+point(item['body'])
    catalog.append(entry);counts[category]+=1
    records.append(dict(type=index,asset=name+'.png',name=item['name'],category=category,source=sheet,crop=box,method='Original alpha retained; isolated sprite; similar views/sizes represented once'))

(root/'assets/scripts/extra-materials.ts').write_text('// Distinct crops from the supplied material sheets. IDs append after the original 48.\nexport const EXTRA_MATERIALS = '+json.dumps(catalog,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
(root/'assets/resources/art/extra-material-sources.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assert len({i['name'] for i in items})==len(items)
print('Prepared',len(catalog),'new materials; category totals:',counts)
import runpy
runpy.run_path(str(root/'tools/apply-material-overrides.py'))
