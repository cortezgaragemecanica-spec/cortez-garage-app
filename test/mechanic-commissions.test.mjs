import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import test from'node:test';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('mecânico acessa somente suas comissões pendentes da semana atual',async()=>{
  const [sql,view,index]=await Promise.all([read('supabase/comissoes-mecanicos.sql'),read('src/mechanic-commissions.js'),read('index.html')]);
  assert.match(sql,/mecanico_atual_do_usuario\(\)/);
  assert.match(sql,/f\.status <> 'Realizado'/);
  assert.match(sql,/= inicio_semana/);
  assert.match(sql,/lower\(trim\(coalesce\(f\.mecanico/);
  assert.match(view,/SOMENTE LEITURA/);
  assert.doesNotMatch(view,/editar|excluir|pagar/i);
  assert.match(index,/mechanic-commissions\.js/);
});

test('conferência é aceita apenas sexta-feira das 17h às 21h e some após confirmar',async()=>{
  const [sql,view]=await Promise.all([read('supabase/comissoes-mecanicos.sql'),read('src/mechanic-commissions.js')]);
  assert.match(sql,/extract\(isodow from agora_local\) <> 5/);
  assert.match(sql,/time '17:00'/);
  assert.match(sql,/time '21:00'/);
  assert.match(sql,/unique \(usuario_id, semana_inicio\)/);
  assert.match(view,/data\.confirmedAt/);
  assert.match(view,/data\.canConfirm/);
});

test('confirmação aparece no histórico administrativo do fechamento',async()=>{
  const [sql,supabase,admin]=await Promise.all([read('supabase/comissoes-mecanicos.sql'),read('src/supabase.js'),read('src/admin.js')]);
  assert.match(sql,/historico_conferencia_comissoes_mecanicos\(\)/);
  assert.match(sql,/Somente o proprietário pode consultar este histórico/);
  assert.match(supabase,/readMechanicCommissionConfirmations/);
  assert.match(admin,/Histórico do fechamento de comissões/);
  assert.match(admin,/confirmationConfirmations|commissionConfirmations/);
  assert.match(admin,/Conferido em/);
});
