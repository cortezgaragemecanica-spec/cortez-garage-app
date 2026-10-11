import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hasPermission,isOwnerAccess,isOwnerEmail} from '../src/supabase.js';
import {isOwnerEmail as isPrivateOwnerEmail} from '../src/mechanic-privacy.js';

const KAUA_EMAILS=['kaugg490@gmail.com','kauavinicius.cortez@gmail.com','kauavinicius.cortezz@gmail.com'];
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const originalStorage=globalThis.localStorage;

function asUser(email){
  globalThis.localStorage={getItem:key=>key==='cortez-garage-supabase-session-v1'?JSON.stringify({access_token:'token',user:{email}}):null};
}

test('todas as contas conhecidas do Kauã usam o perfil integral do proprietário',()=>{
  try{
    for(const email of KAUA_EMAILS){
      asUser(email);
      assert.equal(isOwnerEmail(email),true);
      assert.equal(isOwnerAccess(),true);
      assert.equal(isPrivateOwnerEmail(email),true);
      for(const permission of ['accessApp','manageValues','addOrderItems','viewDelivered','readyOrders','createEntries','editOrders','viewFinance','deleteOrders']){
        assert.equal(hasPermission(permission),true,`${email} deveria possuir ${permission}`);
      }
    }
    asUser('usuario@exemplo.com');
    assert.equal(isOwnerAccess(),false);
    assert.equal(isOwnerEmail('usuario@exemplo.com'),false);
  }finally{
    if(originalStorage===undefined)delete globalThis.localStorage;
    else globalThis.localStorage=originalStorage;
  }
});

test('telas exclusivas consultam a mesma regra central de proprietário',async()=>{
  const files=['admin','agenda','agenda-enhancements','budget-order','closed-order-receipt','order-review-requests','order-workflow','owner-diagnosis-observation','reports','service-quote-requests','stock','technical-report'];
  for(const file of files){
    const source=await read(`src/${file}.js`);
    assert.match(source,/isOwnerAccess/);
  }
});

test('migração do Supabase concede o perfil sem apagar dados',async()=>{
  const sql=await read('supabase/kaua-acesso-proprietario.sql');
  for(const email of KAUA_EMAILS)assert.ok(sql.includes(email));
  assert.match(sql,/create or replace function public\.cortez_acesso_proprietario/);
  assert.match(sql,/create policy financeiro_owner[\s\S]*cortez_acesso_proprietario/);
  assert.match(sql,/create policy sincronizacao_owner_access[\s\S]*cortez_acesso_proprietario/);
  assert.match(sql,/create policy "agenda proprietario insere"[\s\S]*cortez_acesso_proprietario/);
  assert.match(sql,/create or replace function public\.alterar_mecanico_servico_entregue/);
  assert.match(sql,/create or replace function public\.reabrir_os_pronta/);
  assert.doesNotMatch(sql,/\b(truncate|drop table|delete from public\.(clientes|veiculos|ordens_servico|estoque))\b/i);
});
