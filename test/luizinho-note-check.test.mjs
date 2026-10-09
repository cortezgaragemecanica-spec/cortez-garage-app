import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('notas do Luizinho guardam numero e dados da conferencia',async()=>{
  const source=await read('src/supabase.js');
  assert.match(source,/documentNumber:type==='luizinho'/);
  assert.match(source,/checked:type==='luizinho'\?item\?\.checked===true/);
  assert.match(source,/export async function setLuizinhoNoteChecked/);
  assert.match(source,/checkedAt:checked===true\?now:undefined/);
  assert.match(source,/checkedBy:checked===true\?clean\(user\?\.name\|\|user\?\.email\)/);
  assert.match(source,/updateLuizinhoNote[\s\S]*?checked:false,checkedAt:undefined,checkedBy:undefined/);
  assert.match(source,/writeSupplierSettlements\(data,\{allowLuizinhoEditor:true\}\)/);
});

test('acerto mostra progresso e permite conferir cada nota',async()=>{
  const[admin,style,index,worker]=await Promise.all([read('src/admin.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  assert.match(admin,/Notas conferidas/);
  assert.match(admin,/Pendentes de conferência/);
  assert.match(admin,/toggle-luizinho-check/);
  assert.match(admin,/setLuizinhoNoteChecked\(button\.dataset\.id,checked\)/);
  assert.match(admin,/Número da nota do fornecedor/);
  assert.match(admin,/comparada com a nota do fornecedor/);
  assert.match(style,/\.luizinho-check-summary/);
  assert.match(style,/\.luizinho-note-checked/);
  assert.match(index,/admin\.js\?v=20261009-1&amp;w=29/);
  assert.match(index,/style\.css\?v=20261008-2&amp;w=16/);
  assert.match(worker,/cortez-garage-v267-kaua-luizinho/);
});
