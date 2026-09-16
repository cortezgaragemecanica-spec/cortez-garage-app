import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canHandleRequestNotifications,deletePartRequest,deleteServiceQuoteRequest,isKauaUser,markPartRequestSent} from '../src/supabase.js';
import {isServiceQuotePendingForViewer} from '../src/request-notification-state.js';

const originalStorage=globalThis.localStorage;
function asUser(email){globalThis.localStorage={getItem:key=>key==='cortez-garage-supabase-session-v1'?JSON.stringify({user:{email}}):null};}

test('as três contas do Kauã recebem solicitações, mas não podem excluir',async()=>{
  try{
    for(const email of ['kaugg490@gmail.com','kauavinicius.cortez@gmail.com','kauavinicius.cortezz@gmail.com']){
      asUser(email);
      assert.equal(canHandleRequestNotifications(),true);
      assert.equal(isKauaUser(),true);
      await assert.rejects(deletePartRequest('id'),/não pode excluir/);
      await assert.rejects(deleteServiceQuoteRequest('id'),/Somente o proprietário/);
    }
    asUser('cortezgaragemecanica@gmail.com');
    assert.equal(canHandleRequestNotifications(),true);
    assert.equal(isKauaUser(),false);
    asUser('fabiomaier19850901@gmail.com');
    assert.equal(canHandleRequestNotifications(),false);
    await assert.rejects(markPartRequestSent('id'),/não tem permissão/);
  }finally{if(originalStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=originalStorage}
});

test('visualização do proprietário não apaga notificação de serviços para Kauã',()=>{
  const owner='cortezgaragemecanica@gmail.com',kaua='kaugg490@gmail.com';
  const request={individualNotifications:true,status:'Visualizada',viewedBy:{[owner]:'2026-09-15T20:00:00Z'}};
  assert.equal(isServiceQuotePendingForViewer(request,owner),false);
  assert.equal(isServiceQuotePendingForViewer(request,kaua),true);
  assert.equal(isServiceQuotePendingForViewer({...request,viewedBy:{...request.viewedBy,[kaua]:'2026-09-15T20:01:00Z'}},kaua),false);
  assert.equal(isServiceQuotePendingForViewer({status:'Visualizada'},kaua),false);
});

test('telas mostram envio ao fornecedor sem apresentar exclusão para Kauã',async()=>{
  const workflow=await readFile(new URL('../src/order-workflow.js',import.meta.url),'utf8');
  const quote=await readFile(new URL('../src/service-quote-requests.js',import.meta.url),'utf8');
  assert.match(workflow,/canDeletePartRequest=request=>!isKauaUser\(\)/);
  assert.match(workflow,/supplier:canHandleRequestNotifications\(\)/);
  assert.match(workflow,/if\(!canHandleRequestNotifications\(\)\)return alert\('Você não tem permissão para enviar pedidos ao fornecedor/);
  assert.match(quote,/owner\(\)\?deleteButton\(request\):''/);
  assert.match(quote,/if\(!canHandleRequestNotifications\(\)\)return/);
  assert.match(quote,/requests\.filter\(pendingForViewer\)/);
});
