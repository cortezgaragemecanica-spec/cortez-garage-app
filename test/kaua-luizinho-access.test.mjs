import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Kauã pode administrar notas e devoluções do Acerto Luizinho',async()=>{
  const[supabase,sql]=await Promise.all([read('src/supabase.js'),read('supabase/kaua-luizinho-contas-pagar.sql')]);
  assert.match(supabase,/canManageLuizinhoNotes=\(\)=>currentEmail\(\)===OWNER_EMAIL\|\|KAUA_EMAILS\.has\(currentEmail\(\)\)/);
  assert.match(supabase,/saveLuizinhoNote[\s\S]*?canManageLuizinhoNotes\(\)[\s\S]*?stockApplied:false[\s\S]*?writeSupplierSettlements\(data,\{allowLuizinhoEditor:true\}\)/);
  assert.doesNotMatch(supabase,/A nota foi salva, mas a atualização do estoque ficou pendente/);
  assert.match(supabase,/saveLuizinhoNote[\s\S]*?stockApplied:false[\s\S]*?writeSupplierSettlements/);
  assert.match(supabase,/updateLuizinhoNote[\s\S]*?canManageLuizinhoNotes\(\)[\s\S]*?writeSupplierSettlements\(data,\{allowLuizinhoEditor:true\}\)/);
  assert.match(supabase,/deleteLuizinhoNote\(id\)\{if\(!canManageLuizinhoNotes\(\)\)/);
  assert.match(supabase,/writeSupplierSettlements\(data,\{allowLuizinhoEditor=false\}/);
  assert.match(supabase,/rpc\/kaua_salvar_acerto_luizinho/);
  for(const action of ['saveLuizinhoReturn','updateLuizinhoReturn','deleteLuizinhoReturn'])assert.match(supabase,new RegExp(`${action}\\([^)]*\\)\\{if\\(!canManageLuizinhoNotes\\(\\)\\)`));
  assert.match(sql,/security definer/);
  assert.match(sql,/jsonb_set\(coalesce\(dados, '\{\}'::jsonb\), '\{luizinho\}'/);
  assert.match(sql,/grant execute on function public\.kaua_salvar_acerto_luizinho/);
});

test('Financeiro libera todo o Luizinho e somente inclusão em contas a pagar para Kauã',async()=>{
  const admin=await read('src/admin.js');
  assert.match(admin,/kauaLuizinho=kaua&&activeArea==='Acerto fornecedores'&&activeSupplier==='luizinho'/);
  assert.match(admin,/kauaPayables=kaua&&activeArea==='Conta a pagar'/);
  assert.match(admin,/if\(kauaPayables&&element\.matches\('\.add-finance'\)\)return/);
  assert.match(admin,/if\(kauaLuizinho&&element\.matches\('\.luizinho-return-button,\.change-return-week,\.edit-luizinho-return,\.delete-luizinho-return'\)\)return/);
  assert.match(admin,/Acerto Luizinho liberado/);
  assert.doesNotMatch(admin,/readonlyFinanceActions=[^;]*\.add-supplier/);
});

test('banco permite ao Kauã criar somente conta a pagar pendente',async()=>{
  const[supabase,sql]=await Promise.all([read('src/supabase.js'),read('supabase/kaua-luizinho-contas-pagar.sql')]);
  assert.match(supabase,/kauaPayable=KAUA_EMAILS\.has\(currentEmail\(\)\)&&verb==='POST'/);
  assert.match(supabase,/body\?\.categoria==='Conta a pagar'&&body\?\.movimento==='Saída'/);
  assert.match(supabase,/Kauã pode incluir somente contas a pagar pendentes/);
  assert.match(sql,/create policy financeiro_kaua_conta_pagar_insert/);
  assert.match(sql,/categoria = 'Conta a pagar'/);
  assert.match(sql,/movimento = 'Saída'/);
  assert.match(sql,/status = 'Pendente'/);
  assert.match(sql,/"viewFinance":true/);
});

test('proteção de acesso financeiro agrupa mutações em um único quadro',async()=>{
  const [admin,events]=await Promise.all([read('src/admin.js'),read('src/ui-events.js')]);
  assert.match(admin,/function scheduleFinanceAccess\(\)\{if\(financeAccessFrame\)return;/);
  assert.match(admin,/requestAnimationFrame\(\(\)=>\{financeAccessFrame=0;install\(\);applyFinanceReadOnly\(\);enableProgressiveTables/);
  assert.match(admin,/onUiUpdated\(scheduleFinanceAccess\)/);
  assert.doesNotMatch(admin,/new MutationObserver/);
  assert.match(events,/new MutationObserver\(schedule\)/);
});
