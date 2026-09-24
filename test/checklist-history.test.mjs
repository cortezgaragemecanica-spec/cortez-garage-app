import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [main,moduleCode,style,index]=await Promise.all([
  'src/main.js','src/checklist-history.js','src/style.css','index.html'
].map(path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')));

test('checklist deixa de aparecer no menu principal',()=>{
  assert.doesNotMatch(main,/\['checks','Checklists'\]/);
  assert.match(moduleCode,/querySelector\('\[data-route="checks"\]'\)\?\.remove\(\)/);
});

test('checklist aparece somente no histórico do veículo com a data realizada',()=>{
  assert.match(index,/checklist-history\.js\?v=20260924-1/);
  assert.match(moduleCode,/document\.querySelector\('\.vehicle-history'\)/);
  assert.match(moduleCode,/Realizado em \$\{formatDate\(order\.checklistAt\|\|order\.created\)\}/);
  assert.match(moduleCode,/if\(order\?\.checklist\?\.length\)article\.append\(checklistPanel\(order\)\)/);
  assert.match(moduleCode,/if\(section\.querySelector\('h3'\).*==='Checklist de entrada'\)section\.remove\(\)/);
});

test('entrega arquiva e recolhe o checklist dentro do veículo',()=>{
  assert.match(moduleCode,/const archived=order\.status==='Entregue'/);
  assert.match(moduleCode,/panel\.open=!archived/);
  assert.match(moduleCode,/badge\.textContent=archived\?'Arquivado':'Ativo'/);
  assert.match(moduleCode,/Arquivado em \$\{formatDate\(order\.deliveredAt\|\|order\.updatedAt\|\|order\.created\)\}/);
  assert.match(style,/\.vehicle-checklist\.is-archived/);
});
