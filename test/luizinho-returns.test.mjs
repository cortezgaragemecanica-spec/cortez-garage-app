import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{defaultLuizinhoReturnWeek}from'../src/luizinho-payment.js';

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

test('devolução fica separada da nota, reduz o acerto e retira estoque',async()=>{
  const source=await readFile(new URL('../src/supabase.js',import.meta.url),'utf8');
  assert.match(source,/luizinhoReturns:normalizeLuizinhoReturns/);
  assert.match(source,/group\.credit\)\.toFixed\(2\)/);
  assert.match(source,/removeLuizinhoReturnFromStock/);
  assert.match(source,/available-item\.quantity/);
  assert.match(source,/data\.luizinhoReturns\.push\(saved\)/);
  assert.doesNotMatch(source,/data\.luizinho\[[^\]]+\].*saveLuizinhoReturn/);
});

test('janela pesquisa notas, permite escolher semana e mantém histórico',async()=>{
  const[source,index]=await Promise.all([
    readFile(new URL('../src/luizinho-returns.js',import.meta.url),'utf8'),
    readFile(new URL('../index.html',import.meta.url),'utf8')
  ]);
  assert.match(index,/luizinho-returns\.js\?v=20260924-1/);
  assert.match(source,/Buscar código ou descrição/);
  assert.match(source,/Crédito no acerto da semana/);
  assert.match(source,/change-return-week/);
  assert.match(source,/saveLuizinhoReturn/);
  assert.match(source,/updateLuizinhoReturnWeek/);
});

