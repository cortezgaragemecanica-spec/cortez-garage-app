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

test('proprietário transfere comissão de serviço entregue somente na semana vigente',async()=>{
  const [sql,supabase,budget]=await Promise.all([read('supabase/comissoes-mecanicos.sql'),read('src/supabase.js'),read('src/budget-order.js')]);
  assert.match(sql,/alterar_mecanico_servico_entregue/);
  assert.match(sql,/ordem\.status <> 'Entregue'/);
  assert.match(sql,/A O\.S\. não foi entregue na semana vigente/);
  assert.match(sql,/delete from public\.lancamentos_financeiros/);
  assert.match(sql,/round\(sum\([\s\S]*\* 0\.5, 2\)/);
  assert.match(sql,/já foi paga e não pode ser transferida/);
  assert.match(sql,/já foram conferidas e não podem ser transferidas/);
  assert.match(supabase,/reassignDeliveredServiceMechanic/);
  assert.match(budget,/Transferir a comissão deste serviço/);
  assert.match(budget,/order\.status==='Entregue'/);
});

test('ordens entregues são separadas por semana',async()=>{
  const [main,supabase,sql,style,index]=await Promise.all([read('src/main.js'),read('src/supabase.js'),read('supabase/comissoes-mecanicos.sql'),read('src/style.css'),read('index.html')]);
  assert.match(main,/function deliveredWeek/);
  assert.match(main,/function deliveredOrdersByWeek/);
  assert.match(main,/orderGroup==='delivered'\?deliveredOrdersByWeek/);
  assert.match(main,/orderRowsTable\(group\.orders,true\)/);
  assert.match(main,/SEMANA MAIS RECENTE/);
  assert.match(main,/SEMANA ARQUIVADA/);
  assert.match(supabase,/deliveredAt:row\.entregue_em/);
  assert.match(sql,/add column if not exists entregue_em date/);
  assert.match(sql,/create trigger ordens_servico_registrar_data_entrega/);
  assert.match(sql,/min\(f\.vencimento\) filter \(where f\.categoria = 'Comissões'\)/);
  assert.match(sql,/numero in \(3, 5, 7, 8, 13, 20, 24, 26, 27\)/);
  assert.match(sql,/set entregue_em = data_entrada::date/);
  assert.match(style,/\.delivered-week-head/);
  assert.match(index,/main\.js\?v=20260911-2/);
});

test('nova entrada não pede fotos e vincula o mecânico ao usuário conectado',async()=>{
  const [main,index]=await Promise.all([read('src/main.js'),read('index.html')]);
  assert.match(main,/formData=\{mechanic:agendaMechanicForCurrentUser\(\)\}/);
  assert.match(main,/Definido automaticamente pelo usuário conectado/);
  assert.match(main,/photos:\[\]/);
  assert.doesNotMatch(main,/id="photos"/);
  assert.doesNotMatch(main,/Checklist e fotos/);
  assert.doesNotMatch(main,/compressImage/);
  assert.match(index,/main\.js\?v=20260911-2/);
});

test('ações do orçamento ficam juntas e o salvamento manual é removido',async()=>{
  const [budget,workflow,access,index,worker]=await Promise.all([read('src/budget-order.js'),read('src/order-workflow.js'),read('src/access-control.js'),read('index.html'),read('public/sw.js')]);
  assert.match(budget,/id="sendBudget"/);
  assert.match(budget,/order\.status='Aguardando aprovação'/);
  assert.match(budget,/await persist\(true\)/);
  assert.match(budget,/if\(!canManageServices\(\)\)await updateOrderStatus/);
  assert.match(budget,/id="approveBudget"/);
  assert.doesNotMatch(budget,/id="saveBudget"/);
  assert.doesNotMatch(budget,/Salvar orçamento e execução/);
  assert.match(workflow,/approval\.insertBefore\(ready,approval\.querySelector\('#previousStatus'\)\)/);
  assert.match(workflow,/Veículo pronto para entrega/);
  assert.match(access,/if\(save&&!owner\)save\.remove\(\)/);
  assert.match(index,/budget-order\.js\?v=20260911-1/);
  assert.match(index,/order-workflow\.js\?v=20260911-1/);
  assert.match(worker,/cortez-garage-v166/);
});

test('plano de custos abre os lançamentos registrados por categoria',async()=>{
  const [admin,style,index,worker]=await Promise.all([read('src/admin.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  assert.match(admin,/const costPlanEntries=/);
  assert.match(admin,/function openCostPlanDetails/);
  for(const label of ['Registros encontrados','Total realizado','Data','Caixa','Descrição','Valor','Nenhum lançamento registrado nesta categoria e neste mês.'])assert.ok(admin.includes(label));
  assert.match(admin,/expenseKind\(record\.description\)===category/);
  assert.match(admin,/openCostPlanDetails\(row\.dataset\.costCategory\)/);
  assert.match(style,/\.cost-plan-detail-popup/);
  assert.match(index,/admin\.js\?v=20260911-1/);
  assert.match(worker,/cortez-garage-v166/);
});

test('ano e cor são obrigatórios na nova entrada',async()=>{
  const [main,index,worker]=await Promise.all([read('src/main.js'),read('index.html'),read('public/sw.js')]);
  assert.match(main,/function requireVehicleYearAndColor/);
  assert.match(main,/\['year','Ano \*'\],\['color','Cor \*'\]/);
  assert.match(main,/input\.required=true/);
  assert.match(index,/main\.js\?v=20260911-2/);
  assert.match(worker,/cortez-garage-v166/);
});
