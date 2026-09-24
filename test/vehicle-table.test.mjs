import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [moduleCode,style,index]=await Promise.all([
  'src/vehicle-table.js','src/style.css','index.html'
].map(path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')));

test('abas veículos e clientes carregam a visualização em tabela',()=>{
  assert.match(index,/vehicle-table\.js\?v=20260924-2/);
  for(const heading of ['Placa','Veículo','Ano','Cor','Quilometragem','Ações'])assert.ok(moduleCode.includes(`'${heading}'`));
  for(const heading of ['Cliente','Telefone','CPF','Endereço','Veículos'])assert.ok(moduleCode.includes(`'${heading}'`));
  assert.match(moduleCode,/className:'vehicle-table'/);
  assert.match(moduleCode,/className:'client-table'/);
  assert.match(moduleCode,/setAttribute\('role','table'\)/);
  assert.match(style,/\.people-table-head,\.people-table>\.people-card\{display:grid/);
});

test('linhas preservam pesquisa, histórico e exclusão',()=>{
  assert.match(moduleCode,/querySelectorAll\('\.people-card'\)/);
  assert.match(moduleCode,/selector:'\.delete-vehicle'/);
  assert.match(moduleCode,/selector:'\.delete-client'/);
  assert.match(moduleCode,/cells\.forEach\(\(\[value,className\]\)=>row\.insertBefore/);
  assert.match(moduleCode,/row\.click\(\)/);
  assert.doesNotMatch(moduleCode,/remove\.remove/);
});

test('tabela possui rolagem horizontal em telas pequenas',()=>{
  assert.match(style,/\.people-table\{display:block;overflow-x:auto/);
  assert.match(style,/@media\(max-width:700px\).*min-width:730px/);
});
