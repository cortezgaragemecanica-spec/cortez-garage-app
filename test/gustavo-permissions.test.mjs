import test from 'node:test';
import assert from 'node:assert/strict';
import {canAdministerRequests,canHandleRequestNotifications,canManagePurchaseChecklist,getManagedUser,hasPermission,isGustavoUser} from '../src/supabase.js';
import {summarizeOrderChanges} from '../src/owner-order-change-notifications.js';
import {readFile} from 'node:fs/promises';

const originalStorage=globalThis.localStorage;
function asUser(email){globalThis.localStorage={getItem:key=>key==='cortez-garage-supabase-session-v1'?JSON.stringify({access_token:'teste',user:{email,user_metadata:{name:'Gustavo'}}}):null,setItem(){},removeItem(){}}}

test('Gustavo recebe as permissões ampliadas sem acesso financeiro de Compras',()=>{
  try{
    for(const email of ['gust.cribas@gmail.com','gust.ribas@gmail.com','gust.ribas@hotmail.com']){
      asUser(email);const user=getManagedUser(email);
      assert.equal(user.permissions.manageValues,true);
      assert.equal(user.permissions.addOrderItems,true);
      assert.equal(user.permissions.viewDelivered,true);
      assert.equal(hasPermission('editOrders'),true);
      assert.equal(canAdministerRequests(),true);
      assert.equal(canHandleRequestNotifications(),true);
      assert.equal(canManagePurchaseChecklist(),false);
      assert.equal(isGustavoUser(),true);
      assert.equal(hasPermission('viewFinance'),false);
      assert.equal(hasPermission('viewPartnerCommissions'),false);
    }
  }finally{if(originalStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=originalStorage}
});

test('Gustavo não visualiza Financeiro nem Administrativo mesmo com permissão antiga salva',async()=>{
  const admin=await readFile(new URL('../src/admin.js',import.meta.url),'utf8');
  const supabase=await readFile(new URL('../src/supabase.js',import.meta.url),'utf8');
  assert.match(admin,/financeVisible=\(\)=>!isGustavoUser\(\)&&\(financeOwner\(\)\|\|hasPermission\('viewFinance'\)\)/);
  assert.match(admin,/canViewPartnerCommissions=\(\)=>!isGustavoUser\(\)/);
  assert.match(supabase,/required=GUSTAVO_EMAILS\.has\(email\)\?[\s\S]*?viewFinance:false,viewPartnerCommissions:false/);
  assert.match(supabase,/requireFinanceViewing\(\)\{if\(isGustavoUser\(\)\|\|!hasPermission\('viewFinance'\)\)/);
  assert.match(supabase,/gustavoNoFinance20261101/);
});

test('notificação do proprietário detalha peças, serviços e valores alterados',()=>{
  const previous={status:'Em andamento',labor:100,partsValue:50,total:150,budget:{parts:[{description:'Filtro',quantity:1,value:50}],services:[{description:'Troca',mechanic:'Gustavo',value:100}]}};
  const current={...previous,labor:150,partsValue:80,total:230,budget:{parts:[{description:'Filtro premium',quantity:1,value:80}],services:[{description:'Troca completa',mechanic:'Gustavo',value:150}]}};
  const labels=summarizeOrderChanges(previous,current).map(item=>item.label);
  for(const label of ['Mão de obra','Total de peças','Total da O.S.','Peças','Serviços'])assert.ok(labels.includes(label));
});

test('acesso às solicitações não libera ações financeiras da lista de compras',async()=>{
  const source=await readFile(new URL('../src/supabase.js',import.meta.url),'utf8');
  assert.match(source,/excludeOrderPurchaseChecklistItem[\s\S]*?if\(!canManagePurchaseChecklist\(\)\|\|isKauaUser\(\)\)/);
  assert.match(source,/createOrderPurchasePayable[\s\S]*?currentEmail\(\)!==OWNER_EMAIL/);
});
