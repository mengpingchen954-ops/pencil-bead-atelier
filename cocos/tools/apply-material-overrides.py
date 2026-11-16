"""Reapply approved full silhouettes/front-facing art after extracting the original sheets."""
from pathlib import Path
from PIL import Image
import json, shutil

root=Path(__file__).resolve().parents[1]
folder=root/'source-art/material-overrides'
manifest=folder/'manifest.json'
if manifest.exists():
    catalog_path=root/'assets/scripts/extra-materials.ts'
    prefix=catalog_path.read_text(encoding='utf-8').split('=',1)[0]+'= '
    catalog=json.loads(catalog_path.read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))
    records_path=root/'assets/resources/art/extra-material-sources.json'
    records=json.loads(records_path.read_text(encoding='utf-8'))
    for change in json.loads(manifest.read_text(encoding='utf-8')):
        item=catalog[change['type']-48]
        assert item['name']==change['name']
        asset='charm-'+item['id']+'.png' if item.get('id') else 'bead-'+str(change['type'])+'.png'
        image=Image.open(folder/asset)
        assert image.mode=='RGBA' and image.size==(192,192)
        bounds=image.getchannel('A').point(lambda a:255 if a>64 else 0).getbbox()
        assert bounds and min(bounds[:2])>=1 and max(bounds[2:])<=191
        item['bounds']=[round(v/192,4) for v in bounds]
        if 'attachment' in change:item['attachment']=change['attachment']
        if 'threaded' in change:item['threaded']=change['threaded']
        shutil.copyfile(folder/asset,root/'assets/resources'/('art' if item.get('id') else 'beads')/asset)
        record=next(r for r in records if r['type']==change['type'])
        record.update(source=change['source'],method=change['method'])
        record.pop('crop',None)
    catalog_path.write_text(prefix+json.dumps(catalog,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
    records_path.write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Applied',len(json.loads(manifest.read_text(encoding='utf-8'))),'approved material overrides')
