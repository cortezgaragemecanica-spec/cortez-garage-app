import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const read=file=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('nova publicação força atualização no APK sem apagar dados da oficina',async()=>{
  const[boot,index,worker]=await Promise.all([read('src/boot.js'),read('index.html'),read('public/sw.js')]);
  assert.match(boot,/const RELEASE='20261007-5'/);
  assert.match(boot,/localStorage\.setItem\(RELEASE_KEY,RELEASE\)/);
  assert.doesNotMatch(boot,/localStorage\.clear\(\)/);
  assert.match(boot,/caches\.keys\(\).*caches\.delete/s);
  assert.match(boot,/getRegistrations.*unregister/s);
  assert.match(boot,/url\.searchParams\.set\('release',RELEASE\)/);
  assert.match(boot,/location\.replace\(url\.href\)/);
  assert.match(index,/boot\.js\?v=20261007-2/);
  assert.match(worker,/boot\.js\?v=20261007-2/);
  assert.match(worker,/cortez-garage-v259-restricted-user-fresh-sync/);
});
