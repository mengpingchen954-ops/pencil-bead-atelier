"""Build smaller browser images without changing source art, dimensions or alpha."""
from pathlib import Path
from io import BytesIO
from PIL import Image
import hashlib
import json
import sys

web = Path(sys.argv[1])
out = web / 'page-assets'
out.mkdir(exist_ok=True)
manifest = dict(files={}, bytes=0, originalBytes=0)
for source in sorted((web / 'assets/resources/native').rglob('*')):
    if source.suffix.lower() not in ('.png', '.jpg', '.jpeg'):
        continue
    original = source.read_bytes()
    with Image.open(source) as image:
        encoded = BytesIO()
        image.save(encoded, format='WEBP', quality=88, method=6)
        with Image.open(BytesIO(encoded.getvalue())) as decoded:
            assert decoded.size == image.size, source
            if 'A' in image.getbands():
                assert decoded.convert('RGBA').getchannel('A').tobytes() == image.getchannel('A').tobytes(), source
    data = encoded.getvalue()
    manifest['originalBytes'] += len(original)
    if len(data) < len(original):
        name = source.stem + '.' + hashlib.sha256(data).hexdigest()[:12] + '.webp'
        (out / name).write_bytes(data)
        manifest['files'][source.relative_to(web).as_posix()] = 'page-assets/' + name
        manifest['bytes'] += len(data)
    else:
        manifest['bytes'] += len(original)
retained = {Path(name).name for name in manifest['files'].values()}
for file in out.iterdir():
    if file.suffix in ('.json', '.webp') and file.name not in retained:
        file.unlink()
print(json.dumps(manifest))
