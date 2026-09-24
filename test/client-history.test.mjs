import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [moduleCode,style,index]=await Promise.all([
  'src/client-history.js','src/style.css','index.html'
].map(path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')));

test('histórico do cliente agrupa as O.S. por veículo cadastrado',()=>{
  assert.match(index,/client-history\.js\?v=20260924-1/);
  assert.match(moduleCode,/vehicle\.clientId===client\.id/);
  assert.match(moduleCode,/vehicles\.get\(key\)\.orders\.push\(order\)/);
  assert.match(moduleCode,/VEÍCULO CADASTRADO/);
  assert.match(moduleCode,/vehicle\.orders\.length\} O\.S\./);
});

test('cada O.S. abre os serviços, peças, valores e mecânicos',()=>{
  for(const label of ['Serviços executados','Peças e materiais','Mecânico:','Serviços','Peças','Desconto','Total'])assert.ok(moduleCode.includes(label));
  assert.match(moduleCode,/document\.createElement\('details'\)/);
  assert.match(moduleCode,/date\(order\.created\)/);
  assert.match(moduleCode,/service\.mechanic\|\|order\.mechanic/);
  assert.match(moduleCode,/quantity\*unit/);
  assert.match(style,/\.client-order-detail>summary/);
});
