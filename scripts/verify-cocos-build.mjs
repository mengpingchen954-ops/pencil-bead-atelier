import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'cocos-web/build-manifest.json'),'utf8'));
for(const [base,hashes] of [['cocos',manifest.sourceHashes],['cocos-web',manifest.webHashes]])for(const [file,expected] of Object.entries(hashes)){
  const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,base,file))).digest('hex');
  assert.equal(actual,expected,`${base}/${file} differs from the verified Cocos release. Rebuild and package before publishing.`);
}
assert.ok(fs.existsSync(path.join(root,'cocos-web/index.html')));
assert.ok(fs.existsSync(path.join(root,'cocos/assets/scenes/Atelier.scene')));
console.log('Cocos source and production build hashes verified.');
