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

test('status das contas a pagar considera o mês do vencimento',()=>{
  assert.match(admin,/function payableMonthStatus/);
  for(const label of ['Paga · Arquivada','mês anterior','mês vigente','mês futuro'])assert.ok(admin.includes(label));
  assert.match(admin,/dueMonth<currentMonth/);
  assert.match(admin,/dueMonth===currentMonth/);
  assert.match(admin,/payable-overdue/);
  assert.match(style,/\.payable-entry\.payable-overdue td\{background:/);
  assert.match(style,/box-shadow:inset 4px 0 #d93838/);
});

test('versões publicadas invalidam cache do módulo e do estilo',()=>{
  assert.match(index,/admin\.js\?v=20261126-3/);
  assert.match(index,/style\.css\?v=20261126-4/);
  assert.match(worker,/cortez-garage-v346-status-conference/);
  assert.match(worker,/admin\.js\?v=20261126-3/);
  assert.match(worker,/style\.css\?v=20261126-4&w=26/);
});


test('cores por dia do vencimento preservam contas pagas',()=>{
  const source=admin.match(/function payableMonthStatus\([^\n]+/)[0];
  const status=new Function('localDateOnly',`return (${source})`)(d=>d.toISOString().slice(0,10));
  const today=new Date('2026-11-26T12:00:00Z');
  for(const dueDate of ['2026-10-30','2026-11-01','2026-11-25']){
    assert.equal(status({dueDate},{paid:0},today).overdue,true);
  }
  assert.equal(status({dueDate:'2026-11-26'},{paid:25},today).dueToday,true);
  for(const dueDate of ['2026-11-27','2026-12-01'])assert.equal(status({dueDate},{paid:0},today).overdue,false);
  const paid=status({dueDate:'2026-11-25',status:'Realizado'},{paid:100},today);
  assert.equal(paid.overdue,false);
  assert.equal(paid.dueToday,undefined);
  assert.match(admin,/payable-due-today/);
});
