import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import test from'node:test';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('mecânico acessa todas as suas comissões da semana atual, inclusive as já pagas',async()=>{
  const [sql,view,index]=await Promise.all([read('supabase/comissoes-mecanicos.sql'),read('src/mechanic-commissions.js'),read('index.html')]);
  assert.match(sql,/mecanico_atual_do_usuario\(\)/);
  assert.doesNotMatch(sql,/where f\.categoria = 'Comissões'\s+and f\.status <> 'Realizado'/);
  assert.match(sql,/'status', f\.status/);
  assert.match(sql,/= inicio_semana/);
  assert.match(sql,/lower\(trim\(coalesce\(f\.mecanico/);
  assert.match(view,/SOMENTE LEITURA/);
  assert.match(view,/item\.status==='Realizado'\?'Pago':'Pendente'/);
  assert.doesNotMatch(view,/editar|excluir|pagar/i);
  assert.match(index,/mechanic-commissions\.js/);
});

test('atalho de comissões dos mecânicos fica ao lado do Financeiro',async()=>{
  const [view,index,worker]=await Promise.all([read('src/mechanic-commissions.js'),read('index.html'),read('public/sw.js')]);
  assert.match(view,/\.home-menu \.admin-shortcut/);
  assert.match(view,/finance\.insertAdjacentHTML\('afterend'/);
  assert.match(view,/mechanic-commission-shortcut/);
  assert.match(index,/mechanic-commissions\.js\?v=20260914-1/);
  assert.match(worker,/cortez-garage-v186/);
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

test('comissões dos mecânicos e dos sócios usam semana de sábado a sexta',async()=>{
  const [sql,supabase,admin,reports]=await Promise.all([read('supabase/comissoes-mecanicos.sql'),read('src/supabase.js'),read('src/admin.js'),read('src/reports.js')]);
  assert.match(sql,/extract\(dow from agora_local\)::integer \+ 1\) % 7/);
  assert.match(sql,/fim_semana := inicio_semana \+ 6/);
  assert.match(sql,/set semana_inicio = vencimento - \(\(extract\(dow from vencimento\)::integer \+ 1\) % 7\)/);
  assert.match(supabase,/date\.getDate\(\)-\(\(day\+1\)%7\)/);
  assert.match(admin,/function commissionWeek/);
  assert.match(admin,/recebidos de sábado a sexta/);
  assert.doesNotMatch(admin,/isWorkday\(item\.date\)/);
  assert.match(reports,/function weekRange[\s\S]*reference\.getDay\(\)\+1\)%7/);
  assert.match(reports,/Relatórios de sábado a sexta/);
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
  assert.match(index,/main\.js\?v=20260914-1/);
});

test('nova entrada não pede fotos e vincula o mecânico ao usuário conectado',async()=>{
  const [main,index]=await Promise.all([read('src/main.js'),read('index.html')]);
  assert.match(main,/formData=\{mechanic:agendaMechanicForCurrentUser\(\)\}/);
  assert.match(main,/Definido automaticamente pelo usuário conectado/);
  assert.match(main,/photos:\[\]/);
  assert.doesNotMatch(main,/id="photos"/);
  assert.doesNotMatch(main,/Checklist e fotos/);
  assert.doesNotMatch(main,/compressImage/);
  assert.match(index,/main\.js\?v=20260914-1/);
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
  assert.match(index,/budget-order\.js\?v=20260914-2/);
  assert.match(index,/order-workflow\.js\?v=20260914-3/);
  assert.match(worker,/cortez-garage-v186/);
});

test('peça de orçamento ignora o estoque e mantém todos os campos comerciais',async()=>{
  const [budget,style,index,worker]=await Promise.all([read('src/budget-order.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  for(const label of ['Orçamento','Buscar no estoque','Descrição','Marca','Fornecedor','Custo','Markup (%)','Quantidade','Valor de venda','Valor total'])assert.ok(budget.includes(label));
  assert.match(budget,/data-part-mode="budget"[\s\S]*data-part-mode="stock"/);
  assert.match(budget,/if\(stockMode!==['"]budget['"]\)\{await ensureStock\(\)/);
  assert.match(budget,/code:stockMode===['"]budget['"]\?['"]['"]/);
  assert.match(budget,/brand:tr\.querySelector/);
  assert.match(budget,/supplier:tr\.querySelector/);
  assert.match(style,/\.part-code-field\[hidden\],#partStockArea\[hidden\]/);
  assert.match(index,/budget-order\.js\?v=20260914-2/);
  assert.match(worker,/budget-order\.js\?v=20260914-2/);
});

test('PDF da O.S. mostra a marca da peça sem expor o fornecedor',async()=>{
  const [pdf,index,worker]=await Promise.all([read('src/pdf-order.js'),read('index.html'),read('public/sw.js')]);
  assert.match(pdf,/description:item\.description,brand:item\.brand,quantity:item\.quantity,value:item\.value,refused:item\.refused/);
  assert.doesNotMatch(pdf,/item\.supplier/);
  assert.match(pdf,/\[item\.description,item\.brand\]\.filter\(Boolean\)/);
  assert.match(index,/pdf-order\.js\?v=20260914-1/);
  assert.match(worker,/pdf-order\.js\?v=20260914-1/);
});

test('contas a pagar possuem pesquisa, agrupamento, edição e pagamento parcial',async()=>{
  const [admin,supabase,style,index,worker]=await Promise.all([read('src/admin.js'),read('src/supabase.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  for(const label of ['Pesquisar fornecedor','Separar por semana','Separar por mês','Valor original','Valor pago','Saldo','Pagamento parcial','EDITAR CONTA A PAGAR'])assert.ok(admin.includes(label));
  assert.match(admin,/function payableGroups/);
  assert.match(admin,/function filterPayables/);
  assert.match(admin,/class="secondary edit-payable"/);
  assert.match(supabase,/remaining=Math\.max\(0,balance-amount\)/);
  assert.match(supabase,/status:remaining<=\.01\?'Realizado':'Pendente'/);
  assert.match(supabase,/pagamento-conta-\$\{row\.id\}-\$\{crypto\.randomUUID\(\)\}/);
  assert.match(style,/\.payable-period-group\[hidden\]/);
  assert.match(index,/admin\.js\?v=20260914-7/);
  assert.match(worker,/cortez-garage-v186/);
});

test('contas pagas são arquivadas e a pesquisa soma apenas saldos em aberto',async()=>{
  const [admin,index,worker]=await Promise.all([read('src/admin.js'),read('index.html'),read('public/sw.js')]);
  for(const label of ['Pagas arquivadas','Ver contas em aberto','Paga · Arquivada','Em aberto na pesquisa'])assert.ok(admin.includes(label));
  assert.match(admin,/showPayableArchive\?archived:open/);
  assert.match(admin,/if\(row\.dataset\.payableOpen===['"]true['"]\)openTotal\+=Number/);
  assert.match(admin,/id="payableSearchTotal"/);
  assert.match(index,/admin\.js\?v=20260914-7/);
  assert.match(worker,/cortez-garage-v186/);
});

test('contas a pagar permitem selecionar a semana e mostram o total pendente do período',async()=>{
  const [admin,index,worker]=await Promise.all([read('src/admin.js'),read('index.html'),read('public/sw.js')]);
  for(const label of ['Selecionar semana','Todas as semanas','Total da semana selecionada','Selecione uma semana'])assert.ok(admin.includes(label));
  assert.match(admin,/selectedPayableWeek/);
  assert.match(admin,/payablePeriodKey\(record\.dueDate,['"]week['"]\)===selectedPayableWeek/);
  assert.match(admin,/id="payableWeekTotal"/);
  assert.match(index,/admin\.js\?v=20260914-7/);
  assert.match(worker,/cortez-garage-v186/);
});

test('saúde da empresa detalha cada compromisso previsto ao clicar',async()=>{
  const [admin,style,index,worker]=await Promise.all([read('src/admin.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  for(const label of ['Clique para ver cada compromisso','Contas a pagar vencidas ou previstas','Comissões dos mecânicos','Comissões dos sócios','Custos fixos restantes no mês','Saldo devedor da Retífica','Total de compromissos'])assert.ok(admin.includes(label));
  assert.match(admin,/class="company-health-commitments" role="button" tabindex="0"/);
  assert.match(admin,/function openCompanyCommitments/);
  assert.match(admin,/wireCompanyHealth\(\)/);
  assert.match(style,/\.company-health-commitments/);
  assert.match(index,/admin\.js\?v=20260914-7/);
  assert.match(worker,/cortez-garage-v186/);
});

test('cada separação semanal ou mensal de contas mostra o total do período',async()=>{
  const [admin,style,index,worker]=await Promise.all([read('src/admin.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  assert.match(admin,/groupTotal=group\.rows\.reduce/);
  assert.match(admin,/showPayableArchive\?['"]Total pago['"]:['"]Total em aberto['"]/);
  assert.match(admin,/payablePeriod===['"]week['"]\?['"]Semana['"]:['"]Mês['"]/);
  assert.match(style,/\.payable-period-heading strong/);
  assert.match(index,/admin\.js\?v=20260914-7/);
  assert.match(worker,/cortez-garage-v186/);
});

test('cada compromisso da saúde abre a lista dos registros que formam o total',async()=>{
  const [admin,style,index,worker]=await Promise.all([read('src/admin.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  for(const label of ['Clique em um compromisso para ver todos os registros incluídos','Ver lista →','DETALHAMENTO DO COMPROMISSO','Todos os registros que formam este valor','Total do compromisso'])assert.ok(admin.includes(label));
  assert.match(admin,/function commitmentRows/);
  assert.match(admin,/function openCompanyCommitmentList/);
  assert.match(admin,/data-commitment=/);
  assert.match(style,/\.company-commitment-open/);
  assert.match(index,/admin\.js\?v=20260914-7/);
  assert.match(worker,/cortez-garage-v186/);
});

test('plano de custos abre os lançamentos registrados por categoria',async()=>{
  const [admin,style,index,worker]=await Promise.all([read('src/admin.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  assert.match(admin,/const costPlanEntries=/);
  assert.match(admin,/function openCostPlanDetails/);
  for(const label of ['Registros encontrados','Localizado nos caixas','Data','Caixa','Descrição','Valor','Nenhum lançamento registrado nesta categoria e neste mês.'])assert.ok(admin.includes(label));
  assert.match(admin,/expenseKind\(record\.description\)===category/);
  assert.match(admin,/openCostPlanDetails\(row\.dataset\.costCategory\)/);
  assert.match(style,/\.cost-plan-detail-popup/);
  assert.match(index,/admin\.js\?v=20260914-7/);
  assert.match(worker,/cortez-garage-v186/);
});

test('plano de custos permite informar e salvar valores já pagos',async()=>{
  const [admin,supabase,index,worker]=await Promise.all([read('src/admin.js'),read('src/supabase.js'),read('index.html'),read('public/sw.js')]);
  for(const label of ['Total pago','Saldo a pagar','Valor pago no plano','Salvar valores do plano de custos'])assert.ok(admin.includes(label));
  assert.match(admin,/class="cost-plan-paid"/);
  assert.match(admin,/paid:Number\(row\.querySelector\('\.cost-plan-paid'\)\.value\)\|\|0/);
  assert.match(admin,/não cria uma nova saída no caixa/);
  assert.match(supabase,/paid:item\?\.paid===null\|\|item\?\.paid===undefined\?null/);
  assert.match(index,/admin\.js\?v=20260914-7/);
  assert.match(worker,/cortez-garage-v186/);
});

test('ano e cor são obrigatórios na nova entrada',async()=>{
  const [main,index,worker]=await Promise.all([read('src/main.js'),read('index.html'),read('public/sw.js')]);
  assert.match(main,/function requireVehicleYearAndColor/);
  assert.match(main,/\['year','Ano \*'\],\['color','Cor \*'\]/);
  assert.match(main,/input\.required=true/);
  assert.match(index,/main\.js\?v=20260914-1/);
  assert.match(worker,/cortez-garage-v186/);
});

test('telefone cadastrado abre seleção entre veículo existente e novo veículo',async()=>{
  const [main,style,index,worker]=await Promise.all([read('src/main.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  assert.match(main,/function clientVehiclePopup/);
  assert.match(main,/clientId===client\.id/);
  for(const label of ['CLIENTE LOCALIZADO','Incluir este veículo','Incluir novo veículo','Nenhum veículo cadastrado para este cliente.'])assert.ok(main.includes(label));
  assert.match(main,/clientVehiclePopup\(client,input\)/);
  assert.match(style,/\.entry-client-vehicles/);
  assert.match(index,/main\.js\?v=20260914-1/);
  assert.match(worker,/cortez-garage-v186/);
});

test('clientes e veículos possuem pesquisa imediata pelos campos solicitados',async()=>{
  const [main,style,index,worker]=await Promise.all([read('src/main.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  for(const label of ['Pesquisar por nome, telefone, CPF ou endereço','Pesquisar por marca, modelo ou placa','Nenhum resultado'])assert.ok(main.includes(label));
  assert.match(main,/id="peopleSearch"/);
  assert.match(main,/data-person-search/);
  assert.match(main,/event\.target\?\.id!==['"]peopleSearch['"]/);
  assert.match(main,/card\.hidden=!match/);
  assert.match(style,/\.people-toolbar/);
  assert.match(index,/main\.js\?v=20260914-1/);
  assert.match(worker,/cortez-garage-v186/);
});

test('Fábio mantém o vínculo e enxerga comissões mesmo com agenda antiga vazia ou acentuada',async()=>{
  const [supabase,sql,view,index,worker]=await Promise.all([read('src/supabase.js'),read('supabase/comissoes-mecanicos.sql'),read('src/mechanic-commissions.js'),read('index.html'),read('public/sw.js')]);
  assert.match(supabase,/defaultMechanicForEmail/);
  assert.match(supabase,/FABIO_EMAILS\.has\(email\)\?'Fabio'/);
  assert.match(supabase,/clean\(item\.agendaMechanic\)\|\|previous\.agendaMechanic\|\|defaultMechanicForEmail/);
  assert.match(sql,/fabiomaier19850901@gmail\.com'[\s\S]*then 'Fabio'/);
  assert.match(sql,/translate\(lower\(trim\(coalesce\(f\.mecanico/);
  assert.match(view,/mechanic-commission-route/);
  assert.match(index,/mechanic-commissions\.js\?v=20260914-1/);
  assert.match(worker,/cortez-garage-v186/);
});

test('nova entrada gera comprovante em PDF e encaminha para o WhatsApp do cliente',async()=>{
  const [main,receipt,index,worker,activity,manifest,style]=await Promise.all([read('src/main.js'),read('src/entry-receipt.js'),read('index.html'),read('public/sw.js'),read('android/app/src/main/java/com/cortezgarage/app/MainActivity.java'),read('android/app/src/main/AndroidManifest.xml'),read('src/style.css')]);
  assert.match(main,/id="entryReceipt"/);
  assert.match(main,/cortez:entry-created/);
  for(const label of ['Dados do cliente','Dados do veículo','Defeito reclamado','Observações','Checklist de entrada','Mensagem para o cliente','Enviar mensagem primeiro','Enviar PDF pelo WhatsApp','Comprovante de entrada'])assert.ok(receipt.includes(label));
  assert.match(receipt,/%PDF-1\.4/);
  assert.match(receipt,/sharePdfToWhatsApp/);
  assert.match(receipt,/https:\/\/wa\.me\//);
  assert.match(activity,/sharePdfToWhatsApp/);
  assert.match(activity,/application\/pdf/);
  assert.match(activity,/com\.whatsapp/);
  assert.ok(activity.indexOf('setPackage("com.whatsapp.w4b")')<activity.indexOf('setPackage("com.whatsapp")'));
  assert.match(manifest,/com\.whatsapp/);
  assert.match(style,/\.entry-finish-actions/);
  assert.match(receipt,/id='savedEntryReceipt'/);
  assert.match(receipt,/const visibleOrder=/);
  assert.match(index,/entry-receipt\.js\?v=20260911-2/);
  assert.match(worker,/entry-receipt\.js\?v=20260911-2/);
});

test('O.S. recolhe checklist e registra solicitações de peças com aviso ao proprietário',async()=>{
  const [workflow,supabase,access,style,index,worker,activity]=await Promise.all([read('src/order-workflow.js'),read('src/supabase.js'),read('src/access-control.js'),read('src/style.css'),read('index.html'),read('public/sw.js'),read('android/app/src/main/java/com/cortezgarage/app/MainActivity.java')]);
  for(const label of ['☑ Checklist','Solicitar peças','Quantidade','Descrição','Motivo','Mandar para o fornecedor','Solicitado por:'])assert.ok(workflow.includes(label));
  assert.match(workflow,/checklist\.hidden=true/);
  assert.match(workflow,/hasPermission\('editOrders'\).*requestParts/);
  assert.match(workflow,/requestSupplierText/);
  assert.match(workflow,/navigator\.clipboard\.writeText/);
  assert.match(workflow,/CortezAndroid\?\.shareTextToWhatsApp/);
  assert.match(workflow,/partRequestNotifications/);
  assert.match(supabase,/export async function savePartRequest/);
  assert.match(supabase,/entidade:'solicitacao_pecas'/);
  assert.match(supabase,/export async function readPartRequests/);
  assert.match(supabase,/export async function markPartRequestSent/);
  assert.match(access,/:not\(#toggleOrderChecklist\)/);
  assert.match(style,/\.part-request-row/);
  assert.match(activity,/shareTextToWhatsApp/);
  assert.ok(activity.lastIndexOf('setPackage("com.whatsapp.w4b")')<activity.lastIndexOf('setPackage("com.whatsapp")'));
  assert.match(index,/order-workflow\.js\?v=20260914-3/);
  assert.match(index,/access-control\.js\?v=20260914-2/);
  assert.match(worker,/cortez-garage-v186/);
});
