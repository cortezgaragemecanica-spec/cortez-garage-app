import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const read=file=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('nova publicação atualiza sem prender navegador ou atalho em recarregamentos',async()=>{
  const[boot,index,worker]=await Promise.all([read('src/boot.js'),read('index.html'),read('public/sw.js')]);
  assert.match(boot,/const RELEASE='20261101-6'/);
  assert.match(boot,/localStorage\.setItem\(RELEASE_KEY,RELEASE\)/);
  assert.doesNotMatch(boot,/localStorage\.clear\(\)/);
  assert.match(boot,/url\.searchParams\.set\('release',RELEASE\)/);
  assert.match(boot,/history\.replaceState\(history\.state,'',url\.href\)/);
  assert.match(boot,/if\(previousRelease===RELEASE\)return/);
  assert.doesNotMatch(boot,/location\.replace/);
  assert.match(boot,/caches\.keys\(\).*caches\.delete/s);
  assert.match(boot,/getRegistrations.*unregister/s);
  assert.match(boot,/Promise\.race\(\[Promise\.allSettled\(cleanup\),wait\(1800\)\]\)/);
  assert.match(index,/boot\.js\?v=20261101-6/);
  assert.match(worker,/boot\.js\?v=20261101-6/);
  assert.match(worker,/cortez-garage-v323-mobile-responsive/);
  assert.doesNotMatch(worker,/client\.navigate|clients\.matchAll/);
  assert.match(boot,/mainUrl\.searchParams\.set\('release',RELEASE\)/);
});

test('módulos são carregados em lotes para não travar o toque no celular',async()=>{
  const boot=await read('src/boot.js');
  assert.match(boot,/names\.slice\(index,index\+3\)/);
  assert.match(boot,/Promise\.allSettled\(batch\.map\(name=>import\(name\)\)\)/);
  assert.match(boot,/await wait\(0\)/);
  assert.doesNotMatch(boot,/Promise\.allSettled\(names\.map\(name=>import\(name\)\)\)/);
});

test('página de recuperação remove somente o cache do aplicativo e preserva os dados locais',async()=>{
  const recovery=await read('public/recover.html');
  assert.match(recovery,/key\.startsWith\('cortez-garage-'\)/);
  assert.match(recovery,/caches\.delete\(key\)/);
  assert.match(recovery,/getRegistrations.*unregister/s);
  assert.match(recovery,/localStorage\.setItem\('cortez-web-release',release\)/);
  assert.match(recovery,/location\.replace\(target\.href\)/);
  assert.doesNotMatch(recovery,/localStorage\.(?:clear|removeItem)/);
  assert.doesNotMatch(recovery,/cortez-garage-v1|pending-db|recovery-db/);
});
