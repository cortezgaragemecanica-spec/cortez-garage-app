import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import vm from'node:vm';
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
test('reconhecimento dos caixas preserva as formas antigas e exclui baixas sem caixa',async()=>{
 const source=await read('src/admin.js'),code=source.split('\n').find(line=>line.startsWith('const cashAccount=')),context=vm.createContext({});
 vm.runInContext(code,context);
 for(const [paymentType,expected]of [['BB','Banco do Brasil'],['Banco do Brasil','Banco do Brasil'],['ML','Mercado Livre'],['Cartão de crédito','Mercado Livre'],['cartao debito','Mercado Livre'],['Pix','Dinheiro'],['Dinheiro','Dinheiro'],['','Dinheiro'],['Sem movimentação de caixa','Sem movimentação de caixa'],['Transferido para contas a pagar','Sem movimentação de caixa']]){
  context.record={paymentType};assert.equal(vm.runInContext('cashAccount(record)',context),expected);
 }
 const sql=await read('test/sector-database.sql');assert.match(sql,/caixa_lancamento\(item.payment\) is distinct from item.account/);
});
test('migração incremental e instalação nova têm as mesmas rotinas de caixa',async()=>{
 const full=await read('supabase/setores-auto-eletrica.sql'),incremental=await read('supabase/setores-caixas-legados.sql'),start=full.indexOf('create or replace function cortez_ae_private.caixa_lancamento('),end=full.indexOf('create or replace function public.ratear_despesa_setores(');
 assert.ok(incremental.includes(full.slice(start,end)));
 assert.doesNotMatch(incremental,/\b(?:update|delete from|truncate|drop table)\s+public\./i);
 assert.match(incremental,/group by cortez_ae_private.caixa_lancamento\(forma_pagamento\)/);
});
