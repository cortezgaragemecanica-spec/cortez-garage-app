import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('fase 2 inicia o núcleo primeiro e carrega os demais módulos em grupos',async()=>{
  const [html,boot]=await Promise.all([read('index.html'),read('src/boot.js')]);
  assert.match(html,/<template id="moduleManifest"[^>]+data-main="\.\/main\.js/);
  assert.equal((html.match(/<script type="module"/g)||[]).length,1);
  assert.match(html,/<script type="module" src="\.\/src\/boot\.js\?v=20261009-6"><\/script>/);
  assert.match(boot,/await import\(manifest\.dataset\.main\)/);
  assert.match(boot,/Promise\.allSettled/);
  assert.match(boot,/requestIdleCallback/);
  assert.match(boot,/cortez:modules-ready/);
});

test('fase 2 compartilha um único observador de atualização da interface',async()=>{
  const files=['src/ui-events.js','src/stock.js','src/reports.js','src/admin.js','src/agenda.js','src/vehicle-table.js','src/mechanic-commissions.js'];
  const [events,...features]=await Promise.all(files.map(read));
  assert.equal((events.match(/new MutationObserver/g)||[]).length,1);
  assert.match(events,/export function onUiUpdated/);
  for(const source of features){
    assert.match(source,/onUiUpdated/);
    assert.doesNotMatch(source,/new MutationObserver/);
  }
});

test('fase 2 reduz e invalida o cache do aplicativo',async()=>{
  const worker=await read('public/sw.js');
  assert.match(worker,/cortez-garage-v272-order-save-all/);
  assert.match(worker,/boot\.js\?v=20261009-6/);
  assert.match(worker,/ui-events\.js\?v=20260930-1/);
  assert.doesNotMatch(worker,/ASSETS\.push/);
  const shell=(worker.match(/^\s*'\.\//gm)||[]).length;
  assert.ok(shell<=43,`cache inicial deveria ter no máximo 43 itens; recebeu ${shell}`);
});

test('fase 2 mostra carregamento inicial acessível e respeita movimento reduzido',async()=>{
  const [html,style]=await Promise.all([read('index.html'),read('src/style.css')]);
  assert.match(html,/class="app-boot"/);
  assert.match(style,/\.app-boot/);
  assert.match(style,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(style,/:focus-visible/);
});
