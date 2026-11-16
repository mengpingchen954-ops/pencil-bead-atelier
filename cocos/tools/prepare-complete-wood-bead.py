"""Restore the complete supplied wood bead, including the previously clipped right side."""
from pathlib import Path
from PIL import Image
import json
import numpy as np

root=Path(__file__).resolve().parents[1]
folder=root/'source-art/material-overrides'
source=Image.open('E:/Game/手串/UI/珠子/9eb067fe788148993db574628f7e2009.png').convert('RGBA')
# The original extraction centered its circular mask 20 pixels left of this bead.
image=source.crop((375,417,487,531))
image.save(folder/'wood-bead-original.png',optimize=True)
alpha=np.asarray(image.getchannel('A'),dtype=float)
image.putalpha(Image.fromarray(np.clip((alpha-12)*255/242,0,255).astype('uint8')))
bounds=image.getchannel('A').point(lambda a:255 if a>64 else 0).getbbox()
assert bounds and min(bounds[:2])>0 and bounds[2]<image.width and bounds[3]<image.height
image=image.crop(bounds);scale=188/max(image.size)
image=image.resize(tuple(round(side*scale) for side in image.size),Image.Resampling.LANCZOS)
canvas=Image.new('RGBA',(192,192));canvas.alpha_composite(image,((192-image.width)//2,(192-image.height)//2))
canvas.save(folder/'bead-123.png',optimize=True)
path=folder/'manifest.json';records=json.loads(path.read_text(encoding='utf-8'))
records=[r for r in records if r['type']!=123]+[dict(type=123,name='斑纹木珠',source='wood-bead-original.png (complete supplied sheet material)',method='Original complete alpha silhouette retained; corrected source region includes the entire right side; uniform fit and transparent padding, no circle mask')]
path.write_text(json.dumps(sorted(records,key=lambda r:r['type']),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
