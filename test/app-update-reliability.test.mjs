import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const read=file=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('nova publicação atualiza sem prender navegador ou atalho em recarregamentos',async()=>{
  const[boot,index,worker]=await Promise.all([read('src/boot.js'),read('index.html'),read('public/sw.js')]);
  assert.match(boot,/const RELEASE='20261101-4'/);
  assert.match(boot,/localStorage\.setItem\(RELEASE_KEY,RELEASE\)/);
  assert.doesNotMatch(boot,/localStorage\.clear\(\)/);
  assert.match(boot,/url\.searchParams\.set\('release',RELEASE\)/);
  assert.match(boot,/history\.replaceState\(history\.state,'',url\.href\)/);
  assert.doesNotMatch(boot,/location\.replace/);
  assert.doesNotMatch(boot,/getRegistrations|unregister|caches\.delete/);
  assert.match(index,/boot\.js\?v=20261101-4/);
  assert.match(worker,/boot\.js\?v=20261101-4/);
  assert.match(worker,/cortez-garage-v321-open-fix/);
  assert.doesNotMatch(worker,/client\.navigate|clients\.matchAll/);
  assert.match(boot,/mainUrl\.searchParams\.set\('release',RELEASE\)/);
});
