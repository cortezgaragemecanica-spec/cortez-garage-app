import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{defaultLuizinhoReturnWeek,isLuizinhoReturnArchived}from'../src/luizinho-payment.js';

test('sugere a semana atual para devoluções de segunda a quarta',()=>{
  assert.equal(defaultLuizinhoReturnWeek('2026-09-21'),'2026-09-21');
  assert.equal(defaultLuizinhoReturnWeek('2026-09-22'),'2026-09-21');
  assert.equal(defaultLuizinhoReturnWeek('2026-09-23'),'2026-09-21');
});

test('sugere a próxima semana de quinta a domingo',()=>{
  assert.equal(defaultLuizinhoReturnWeek('2026-09-24'),'2026-09-28');
  assert.equal(defaultLuizinhoReturnWeek('2026-09-25'),'2026-09-28');
  assert.equal(defaultLuizinhoReturnWeek('2026-09-27'),'2026-09-28');
});

test('arquiva devoluções de semanas anteriores e mantém atuais ou futuras abertas',()=>{
  assert.equal(isLuizinhoReturnArchived('2026-09-28','2026-10-06'),true);
  assert.equal(isLuizinhoReturnArchived('2026-10-05','2026-10-06'),false);
  assert.equal(isLuizinhoReturnArchived('2026-10-12','2026-10-06'),false);
});

test('devolução fica separada da nota, reduz o acerto e retira estoque',async()=>{
  const source=await readFile(new URL('../src/supabase.js',import.meta.url),'utf8');
  assert.match(source,/luizinhoReturns:normalizeLuizinhoReturns/);
  assert.match(source,/group\.credit\)\.toFixed\(2\)/);
  assert.match(source,/removeLuizinhoReturnFromStock/);
  assert.match(source,/available-item\.quantity/);
  assert.match(source,/data\.luizinhoReturns\.push\(\.\.\.saved\)/);
  assert.match(source,/applyLuizinhoReturnStockChange/);
  assert.match(source,/body:\{quantidade:quantity\}/);
  assert.doesNotMatch(source,/body:\{quantidade\}\}\}\)/);
  assert.match(source,/export async function updateLuizinhoReturn/);
  assert.match(source,/export async function deleteLuizinhoReturn/);
  assert.doesNotMatch(source,/data\.luizinho\[[^\]]+\].*saveLuizinhoReturn/);
});

test('janela pesquisa notas, permite escolher semana e mantém histórico',async()=>{
  const[source,index]=await Promise.all([
    readFile(new URL('../src/luizinho-returns.js',import.meta.url),'utf8'),
    readFile(new URL('../index.html',import.meta.url),'utf8')
  ]);
  assert.match(index,/luizinho-returns\.js\?v=20261010-3/);
  assert.match(source,/Buscar código ou descrição/);
  assert.match(source,/Crédito no acerto da semana/);
  assert.match(source,/Itens da devolução/);
  assert.match(source,/edit-luizinho-return/);
  assert.match(source,/delete-luizinho-return/);
  assert.match(source,/saveLuizinhoReturn/);
  assert.match(source,/updateLuizinhoReturn/);
  assert.match(source,/deleteLuizinhoReturn/);
  assert.match(source,/Atuais e programadas/);
  assert.match(source,/Arquivadas/);
  assert.match(source,/isLuizinhoReturnArchived/);
});

