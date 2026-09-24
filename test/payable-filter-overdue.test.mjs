import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [admin,style,index,worker]=await Promise.all([
  'src/admin.js','src/style.css','index.html','public/sw.js'
].map(path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')));

test('contas a pagar oferecem pesquisa por categoria',()=>{
  assert.match(admin,/id="payableCategorySearch"/);
  for(const category of ['Todas as categorias','Boleto','Conta mensal','Acerto','Sem categoria'])assert.ok(admin.includes(category));
  assert.match(admin,/data-payable-category=/);
  assert.match(admin,/payableCategorySearch=category/);
  assert.match(admin,/category==='__sem_categoria__'/);
  assert.match(admin,/querySelector\('#payableCategorySearch'\)\.addEventListener\('change'/);
});

test('pesquisa combina descrição e categoria e atualiza total visível',()=>{
  assert.match(admin,/includes\(query\)&&\(!category/);
  assert.match(admin,/if\(match\)\{visible\+\+;visibleTotal\+\+;/);
  assert.match(admin,/openTotal\+=Number\(row\.dataset\.payableRemaining/);
});

test('somente contas abertas com vencimento anterior a hoje recebem destaque',()=>{
  assert.match(admin,/record\.status!==\'Realizado\'.*record\.dueDate.*<localDateOnly\(new Date\(\)\)/);
  assert.match(admin,/payable-overdue/);
  assert.match(style,/\.payable-entry\.payable-overdue td\{background:/);
  assert.match(style,/box-shadow:inset 4px 0 #d93838/);
});

test('versões publicadas invalidam cache do módulo e do estilo',()=>{
  assert.match(index,/admin\.js\?v=20260924-6/);
  assert.match(index,/style\.css\?v=20260924-4/);
  assert.match(worker,/cortez-garage-v228/);
  assert.match(worker,/admin\.js\?v=20260924-6/);
  assert.match(worker,/style\.css\?v=20260923-2/);
});

