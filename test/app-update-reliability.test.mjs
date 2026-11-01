import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const read=file=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('nova publicação atualiza sem prender navegador ou atalho em recarregamentos',async()=>{
  const[boot,index,worker]=await Promise.all([read('src/boot.js'),read('index.html'),read('public/sw.js')]);
  assert.match(boot,/const RELEASE='20261101-9'/);
  assert.match(boot,/localStorage\.setItem\(RELEASE_KEY,RELEASE\)/);
  assert.doesNotMatch(boot,/localStorage\.clear\(\)/);
  assert.match(boot,/url\.searchParams\.set\('release',RELEASE\)/);
  assert.match(boot,/history\.replaceState\(history\.state,'',url\.href\)/);
  assert.match(boot,/if\(previousRelease===RELEASE\)return/);
  assert.doesNotMatch(boot,/location\.replace/);
  assert.match(boot,/caches\.keys\(\).*caches\.delete/s);
  assert.match(boot,/getRegistrations.*unregister/s);
  assert.match(boot,/Promise\.race\(\[Promise\.allSettled\(cleanup\),wait\(1800\)\]\)/);
  assert.match(index,/boot\.js\?v=20261101-9/);
  assert.match(worker,/boot\.js\?v=20261101-9/);
  assert.match(worker,/cortez-garage-v326-mobile-responsive/);
  assert.doesNotMatch(worker,/client\.navigate|clients\.matchAll/);
  assert.match(boot,/mainUrl\.searchParams\.set\('release',RELEASE\)/);
  assert.match(boot,/cachedDatabase\?\.length>1000000/);
  assert.match(boot,/!localStorage\.getItem\(PENDING_DATABASE_KEY\)/);
  assert.match(boot,/localStorage\.setItem\(RECOVERY_DATABASE_KEY,cachedDatabase\)/);
  assert.match(boot,/localStorage\.removeItem\(DATABASE_CACHE_KEY\)/);
  assert.match(worker,/cache\.addAll\(CORE\.map/);
  assert.doesNotMatch(worker,/cache\.addAll\(SHELL\.map/);
});

test('módulos são carregados um por vez e em momentos ociosos para não travar o toque no celular',async()=>{
  const boot=await read('src/boot.js');
  assert.match(boot,/for\(const name of names\)/);
  assert.match(boot,/await waitForIdle\(\)/);
  assert.match(boot,/Promise\.allSettled\(\[import\(name\)\]\)/);
  assert.match(boot,/await wait\(16\)/);
  assert.match(boot,/await workflowReady;\s*await wait\(500\);\s*const featuresReady=/s);
  assert.doesNotMatch(boot,/Promise\.all\(\[workflowReady,loadModules/);
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
