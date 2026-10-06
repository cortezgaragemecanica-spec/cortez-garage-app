import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Kauã pode incluir e alterar somente notas do Acerto Luizinho',async()=>{
  const supabase=await read('src/supabase.js');
  assert.match(supabase,/canManageLuizinhoNotes=\(\)=>currentEmail\(\)===OWNER_EMAIL\|\|KAUA_EMAILS\.has\(currentEmail\(\)\)/);
  assert.match(supabase,/saveLuizinhoNote[\s\S]*?canManageLuizinhoNotes\(\)[\s\S]*?stockApplied:false[\s\S]*?writeSupplierSettlements\(data,\{allowLuizinhoEditor:true\}\)/);
  assert.match(supabase,/A nota foi salva, mas a atualização do estoque ficou pendente/);
  assert.match(supabase,/updateLuizinhoNote[\s\S]*?canManageLuizinhoNotes\(\)[\s\S]*?writeSupplierSettlements\(data,\{allowLuizinhoEditor:true\}\)/);
  assert.match(supabase,/deleteLuizinhoNote\(id\)\{if\(currentEmail\(\)!==OWNER_EMAIL\)/);
  assert.match(supabase,/writeSupplierSettlements\(data,\{allowLuizinhoEditor=false\}/);
  assert.match(supabase,/if\(currentEmail\(\)===OWNER_EMAIL\)await syncLuizinhoPayables/);
});

test('Financeiro preserva incluir e editar Luizinho para Kauã sem liberar exclusão',async()=>{
  const admin=await read('src/admin.js');
  assert.match(admin,/kauaLuizinho=canManageLuizinhoNotes\(\)&&activeArea==='Acerto fornecedores'&&activeSupplier==='luizinho'/);
  assert.match(admin,/kauaLuizinho\?'\.delete-supplier':'\.add-supplier,\.edit-supplier,\.delete-supplier,\.toggle-luizinho-check'/);
  assert.match(admin,/você pode incluir, editar e conferir notas do Acerto Luizinho/);
  assert.doesNotMatch(admin,/readonlyFinanceActions=[^;]*\.add-supplier/);
});

test('proteção de acesso financeiro agrupa mutações em um único quadro',async()=>{
  const [admin,events]=await Promise.all([read('src/admin.js'),read('src/ui-events.js')]);
  assert.match(admin,/function scheduleFinanceAccess\(\)\{if\(financeAccessFrame\)return;/);
  assert.match(admin,/requestAnimationFrame\(\(\)=>\{financeAccessFrame=0;install\(\);applyFinanceReadOnly\(\);enableProgressiveTables/);
  assert.match(admin,/onUiUpdated\(scheduleFinanceAccess\)/);
  assert.doesNotMatch(admin,/new MutationObserver/);
  assert.match(events,/new MutationObserver\(schedule\)/);
});
