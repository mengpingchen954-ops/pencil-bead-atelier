"""Extract the supplied floral design; reward text and states are rendered live."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import json, sys, uuid

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]) if len(sys.argv) > 1 else root/'source-art/daily-reference.png'
art = Image.open(source).convert('RGBA')
assert art.size == (1520, 2720), 'Expected the approved 1520 x 2720 design'
out = root/'assets/resources/art'

def blank(image, box, sample):
    image = image.copy()
    patch = image.crop(sample).resize((box[2]-box[0], box[3]-box[1]), Image.Resampling.BICUBIC)
    layer=image.copy();layer.paste(patch, box)
    mask=Image.new('L',image.size)
    ImageDraw.Draw(mask).rectangle(box,fill=255)
    return Image.composite(layer,image,mask.filter(ImageFilter.GaussianBlur(2)))

def save(image, name):
    image = image.resize((round(image.width*.5), round(image.height*.5)), Image.Resampling.LANCZOS)
    file = out/('pencil-'+name+'.png')
    image.save(file, optimize=True)
    meta_file = Path(str(file)+'.meta')
    meta = json.loads((meta_file if meta_file.exists() else out/'pencil-frame.png.meta').read_text(encoding='utf-8'))
    asset_id = meta['uuid'] if meta_file.exists() else str(uuid.uuid4())
    meta.update(uuid=asset_id, files=['.json','.png'])
    for key, sub in meta['subMetas'].items():
        sub.update(uuid=asset_id+'@'+key, displayName=file.stem)
        data = sub['userData']
        data['imageUuidOrDatabaseUri'] = asset_id+('@6c48a' if key=='f9941' else '')
        if key=='f9941':
            data.update(trimType='none',trimX=0,trimY=0,offsetX=0,offsetY=0,width=image.width,height=image.height,rawWidth=image.width,rawHeight=image.height)
            data.pop('vertices',None)
    meta['userData'].update(hasAlpha=True,redirect=asset_id+'@f9941')
    meta_file.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

# Sample neighboring unlettered paint to preserve the reference's texture.
panel = art.copy()
for box, sample in [
    ((533,445,990,571),(1004,454,1025,562)),
    ((610,595,910,654),(620,660,900,675)),
    ((345,679,1160,801),(350,806,1160,819)),
    ((169,823,1347,1947),(350,806,1160,819)),
    ((310,1997,1210,2105),(320,2110,1200,2128)),
    ((450,2162,1065,2257),(1090,2170,1120,2248)),
]:
    panel = blank(panel,box,sample)
# Keep the floral silhouette, without the sample home screen behind the modal.
mask = Image.new('L', art.size)
ImageDraw.Draw(mask).polygon([
    (36,879),(49,778),(80,700),(73,628),(94,552),(64,488),(98,456),
    (148,445),(174,407),(218,421),(249,391),(289,411),(300,463),
    (349,441),(398,391),(401,437),(555,417),(758,405),(960,419),
    (1164,452),(1180,415),(1222,437),(1258,419),(1309,451),(1311,482),
    (1371,477),(1411,496),(1431,539),(1420,590),(1402,619),
    (1433,677),(1466,735),(1460,817),(1438,856),(1446,901),
    (1420,931),(1411,1525),(1450,1587),(1442,1669),(1410,1715),
    (1410,1950),(1464,2017),(1462,2085),(1424,2139),(1444,2213),
    (1436,2290),(1394,2327),(1295,2339),(1207,2334),(1073,2325),
    (327,2331),(227,2332),(167,2315),(125,2274),(106,2201),
    (76,2173),(89,2109),(122,2078),(116,1750),(46,1745),(31,1705),
    (37,1650),(28,1612),(57,1579),(68,1534),(103,1580),(113,1170),
    (109,933),(85,911),(60,895)
],fill=255)
panel.putalpha(mask.filter(ImageFilter.GaussianBlur(1)))
save(panel.crop((24,390,1480,2340)), 'daily-panel')

card = art.copy()
for box,sample in [((620,860,920,934),(600,1090,930,1103)),((610,1036,930,1088),(600,1090,930,1103)),((695,1125,845,1178),(612,1130,674,1175))]:
    card=blank(card,box,sample)
card=card.crop((575,835,948,1218))
save(card,'daily-card')
gold=Image.new('RGBA',card.size,'#f8da86')
save(Image.blend(card,gold,.16),'daily-current')

seventh = art.copy()
for box,sample in [((535,1675,1080,1744),(1085,1680,1120,1740)),((633,1760,800,1817),(1085,1760,1120,1817)),((924,1760,1075,1817),(1085,1760,1120,1817)),((672,1839,875,1894),(603,1850,655,1880))]:
    seventh=blank(seventh,box,sample)
save(seventh.crop((189,1644,1332,1939)), 'daily-seventh')

settings_source=Path(sys.argv[2]) if len(sys.argv)>2 else root/'source-art/settings-reference.png'
settings=Image.open(settings_source).convert('RGBA')
assert settings.size==(1520,2720), 'Expected the approved settings design'
for box,sample in [((375,565,1150,653),(400,651,700,663)),((450,798,1110,867),(1090,790,1170,870)),((450,964,1110,1035),(1090,958,1170,1040)),((450,1130,1110,1204),(1090,1123,1170,1205)),((450,1300,1110,1372),(1090,1290,1170,1374)),((450,1464,1110,1540),(1090,1458,1170,1542)),((450,1634,1110,1708),(1090,1628,1170,1711)),((630,1890,900,1969),(960,1884,1040,1973)),((420,2035,1110,2168),(450,2172,1090,2187))]:
    settings=blank(settings,box,sample)
mask=Image.new('L',settings.size)
ImageDraw.Draw(mask).polygon([(32,740),(51,677),(55,608),(96,572),(94,522),(131,500),(151,475),(193,487),(201,449),(229,429),(271,440),(288,465),(1350,457),(1396,487),(1427,520),(1422,2169),(1402,2204),(1379,2209),(1365,2245),(1305,2253),(1240,2241),(1158,2244),(1114,2230),(973,2243),(807,2236),(743,2253),(679,2233),(566,2248),(474,2236),(415,2250),(346,2230),(285,2257),(233,2237),(182,2240),(144,2211),(115,2203),(96,2164),(95,785),(65,775)],fill=255)
settings.putalpha(mask.filter(ImageFilter.GaussianBlur(1)))
save(settings.crop((24,428,1440,2260)),'settings-panel')
music_source=Path(sys.argv[3]) if len(sys.argv)>3 else root/'source-art/music-reference.png'
music=Image.open(music_source).convert('RGBA')
assert music.size==(1520,2720), 'Expected the approved music design'
for box,sample in [((480,530,1060,613),(500,654,1050,668)),((378,677,1140,731),(400,739,1130,760)),((200,773,1368,1617),(400,1631,1130,1650)),((591,1674,938,1738),(590,1748,940,1760)),((345,1763,1175,1881),(350,1894,1170,1914)),((350,1981,581,2047),(610,1980,670,2049)),((976,1981,1140,2047),(1160,1980,1210,2049)),((363,2149,1157,2200),(370,2206,1150,2225))]:
    music=blank(music,box,sample)
mask=Image.new('L',music.size)
ImageDraw.Draw(mask).polygon([(33,727),(49,645),(39,592),(65,548),(49,505),(88,469),(97,427),(144,407),(158,437),(178,398),(209,381),(230,416),(246,378),(275,365),(317,378),(347,403),(376,457),(1285,458),(1304,433),(1367,432),(1408,468),(1421,514),(1408,550),(1454,554),(1450,610),(1478,655),(1458,686),(1410,662),(1410,2049),(1444,2089),(1449,2145),(1428,2199),(1415,2257),(1364,2296),(1294,2303),(1236,2283),(1164,2283),(308,2283),(301,2300),(222,2305),(161,2280),(106,2274),(61,2231),(60,2152),(76,2115),(81,2055),(110,2108),(111,730),(79,757)],fill=255)
music.putalpha(mask.filter(ImageFilter.GaussianBlur(1)))
save(music.crop((24,365,1480,2305)),'music-panel')
for name,box,text,sample in [
    ('music-row',(210,779,1311,905),(600,809,970,874),(1050,809,1170,874)),
    ('music-selected',(210,1180,1365,1350),(635,1233,920,1299),(940,1230,1100,1300)),
]:
    row=Image.open(music_source).convert('RGBA')
    row=blank(row,text,sample)
    row=row.crop(box)
    if name=='music-selected':
        row_mask=Image.new('L',row.size)
        ImageDraw.Draw(row_mask).polygon([(15,25),(1055,25),(1082,2),(1139,0),(1133,49),(1154,98),(1126,128),(1108,168),(1070,150),(1046,146),(25,146),(0,116),(0,58)],fill=255)
        row.putalpha(row_mask.filter(ImageFilter.GaussianBlur(1)))
    save(row,name)
showcase_source=Path(sys.argv[4]) if len(sys.argv)>4 else root/'source-art/showcase-reference.png'
showcase=Image.open(showcase_source).convert('RGBA')
assert showcase.size==(1520,2720), 'Expected the approved showcase design'
for box,sample in [((94,249,550,303),(560,250,680,303)),((94,350,902,439),(930,350,1010,439)),((100,479,800,540),(820,480,1000,540)),((1090,249,1340,313),(1040,250,1080,312)),((88,581,1443,709),(400,718,1000,752)),((374,1450,1155,1542),(380,1547,1140,1570)),((450,1578,1090,1646),(450,1651,1090,1667)),((265,1671,1240,1743),(280,1754,1230,1782)),((230,1795,1210,2168),(400,2190,1100,2240))]:
    showcase=blank(showcase,box,sample)
save(showcase.crop((0,175,1520,2405)),'showcase-background')
original=Image.open(showcase_source).convert('RGBA')
for name,box,text,sample in [
    ('showcase-tab-active',(94,586,525,701),(195,617,455,675),(120,613,175,676)),
    ('showcase-tab',(549,586,981,701),(685,617,885,675),(585,611,645,676)),
    ('showcase-diy',(230,1795,1200,1986),(569,1858,953,1940),(1000,1856,1130,1943)),
    ('showcase-gather',(321,2028,1181,2160),(625,2050,918,2124),(450,2050,565,2124)),
]:
    image=blank(original,text,sample)
    save(image.crop(box),name)
album_source=Path(sys.argv[5]) if len(sys.argv)>5 else root/'source-art/album-reference.png'
album=Image.open(album_source).convert('RGBA')
assert album.size==(1520,2720), 'Expected the approved album design'
for box,sample in [((550,234,975,270),(550,274,975,286)),((400,294,1120,370),(410,374,1110,394)),((360,406,1140,455),(365,459,1135,473)),((146,579,1379,2059),(85,900,130,1450)),((105,2080,1412,2340),(450,2068,1000,2082))]:
    album=blank(album,box,sample)
save(album.crop((0,175,1520,2405)),'album-background')
card=Image.open(album_source).convert('RGBA')
for box,sample in [((280,588,634,882),(642,632,689,863)),((320,889,610,954),(320,918,321,919)),((300,970,650,1026),(670,995,671,996))]:
    card=blank(card,box,sample)
save(card.crop((154,582,745,1054)),'album-live-card')
print('Prepared daily, settings, music, showcase and album artwork with live text areas')
