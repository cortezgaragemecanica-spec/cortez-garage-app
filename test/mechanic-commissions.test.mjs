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
  assert.match(sql,/servico ->> 'commissionRate'/);
  assert.match(sql,/coalesce\(nullif\(servico ->> 'commissionRate', ''\)::numeric, 0\.5\)/);
  assert.match(sql,/já foi paga e não pode ser transferida/);
  assert.match(sql,/já foram conferidas e não podem ser transferidas/);
  assert.match(supabase,/reassignDeliveredServiceMechanic/);
  assert.match(budget,/Transferir a comissão deste serviço/);
  assert.match(budget,/order\.status==='Entregue'/);
});

test('proprietário define a comissão individual de cada serviço antes da entrega',async()=>{
  const [budget,supabase,admin,reports,sql]=await Promise.all([read('src/budget-order.js'),read('src/supabase.js'),read('src/admin.js'),read('src/reports.js'),read('supabase/comissoes-mecanicos.sql')]);
  assert.match(budget,/Comissão %/);
  assert.match(budget,/data-field="commissionRate"/);
  assert.match(budget,/owner\(\)\?commissionField/);
  assert.match(budget,/order\.status==='Entregue'/);
  assert.match(budget,/commissionRate:Number\.isFinite/);
  assert.match(supabase,/serviceCommissionRate/);
  assert.match(supabase,/Number\(service\.value\|\|0\)\*serviceCommissionRate\(service\)/);
  assert.match(supabase,/commissionRate:\.5/);
  assert.match(admin,/item\.value\|\|0\)\*rate/);
  assert.match(reports,/item\.value\|\|0\)\*rate/);
  assert.match(sql,/servico ->> 'commissionRate'/);
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
  assert.match(index,/main\.js\?v=20260918-1/);
});

test('nova entrada não pede fotos e vincula o mecânico ao usuário conectado',async()=>{
  const [main,index]=await Promise.all([read('src/main.js'),read('index.html')]);
  assert.match(main,/formData=\{mechanic:agendaMechanicForCurrentUser\(\)\}/);
  assert.match(main,/Definido automaticamente pelo usuário conectado/);
  assert.match(main,/photos:\[\]/);
  assert.doesNotMatch(main,/id="photos"/);
  assert.doesNotMatch(main,/Checklist e fotos/);
  assert.doesNotMatch(main,/compressImage/);
  assert.match(index,/main\.js\?v=20260918-1/);
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
  assert.match(index,/budget-order\.js\?v=20260922-1/);
  assert.match(index,/order-workflow\.js\?v=20260918-1/);

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
  assert.match(index,/budget-order\.js\?v=20260922-1/);
  assert.match(worker,/budget-order\.js\?v=20260922-1/);
});

test('PDF da O.S. mostra a marca da peça sem expor o fornecedor',async()=>{
  const [pdf,index,worker]=await Promise.all([read('src/pdf-order.js'),read('index.html'),read('public/sw.js')]);
  assert.match(pdf,/description:item\.description,brand:item\.brand,quantity:item\.quantity,value:item\.value,refused:item\.refused/);
  assert.doesNotMatch(pdf,/item\.supplier/);
  assert.match(pdf,/\[item\.description,item\.brand\]\.filter\(Boolean\)/);
  assert.match(index,/pdf-order\.js\?v=20260915-2/);
  assert.match(worker,/pdf-order\.js\?v=20260915-2/);
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
  assert.match(index,/admin\.js\?v=20260924-6/);

});

test('contas pagas são arquivadas e a pesquisa soma apenas saldos em aberto',async()=>{
  const [admin,index,worker]=await Promise.all([read('src/admin.js'),read('index.html'),read('public/sw.js')]);
  for(const label of ['Pagas arquivadas','Ver contas em aberto','Paga · Arquivada','Em aberto na pesquisa'])assert.ok(admin.includes(label));
  assert.match(admin,/showPayableArchive\?archived:open/);
  assert.match(admin,/if\(row\.dataset\.payableOpen===['"]true['"]\)openTotal\+=Number/);
  assert.match(admin,/id="payableSearchTotal"/);
  assert.match(index,/admin\.js\?v=20260924-6/);

});

test('contas a pagar permitem selecionar a semana e mostram o total pendente do período',async()=>{
  const [admin,index,worker]=await Promise.all([read('src/admin.js'),read('index.html'),read('public/sw.js')]);
  for(const label of ['Selecionar semana','Todas as semanas','Total da semana selecionada','Selecione uma semana'])assert.ok(admin.includes(label));
  assert.match(admin,/selectedPayableWeek/);
  assert.match(admin,/payablePeriodKey\(record\.dueDate,['"]week['"]\)===selectedPayableWeek/);
  assert.match(admin,/id="payableWeekTotal"/);
  assert.match(index,/admin\.js\?v=20260924-6/);

});

test('saúde da empresa detalha cada compromisso previsto ao clicar',async()=>{
  const [admin,style,index,worker]=await Promise.all([read('src/admin.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  for(const label of ['Clique para ver cada compromisso','Contas a pagar vencidas ou previstas','Comissões dos mecânicos','Comissões dos sócios','Custos fixos restantes no mês','Saldo devedor da Retífica','Total de compromissos'])assert.ok(admin.includes(label));
  assert.match(admin,/class="company-health-commitments" role="button" tabindex="0"/);
  assert.match(admin,/function openCompanyCommitments/);
  assert.match(admin,/wireCompanyHealth\(\)/);
  assert.match(style,/\.company-health-commitments/);
  assert.match(index,/admin\.js\?v=20260924-6/);

});

test('cada separação semanal ou mensal de contas mostra o total do período',async()=>{
  const [admin,style,index,worker]=await Promise.all([read('src/admin.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  assert.match(admin,/groupTotal=group\.rows\.reduce/);
  assert.match(admin,/showPayableArchive\?['"]Total pago['"]:['"]Total em aberto['"]/);
  assert.match(admin,/payablePeriod===['"]week['"]\?['"]Semana['"]:['"]Mês['"]/);
  assert.match(style,/\.payable-period-heading strong/);
  assert.match(index,/admin\.js\?v=20260924-6/);

});

test('cada compromisso da saúde abre a lista dos registros que formam o total',async()=>{
  const [admin,style,index,worker]=await Promise.all([read('src/admin.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  for(const label of ['Clique em um compromisso para ver todos os registros incluídos','Ver lista →','DETALHAMENTO DO COMPROMISSO','Todos os registros que formam este valor','Total do compromisso'])assert.ok(admin.includes(label));
  assert.match(admin,/function commitmentRows/);
  assert.match(admin,/function openCompanyCommitmentList/);
  assert.match(admin,/data-commitment=/);
  assert.match(style,/\.company-commitment-open/);
  assert.match(index,/admin\.js\?v=20260924-6/);

});

test('plano de custos abre os lançamentos registrados por categoria',async()=>{
  const [admin,style,index,worker]=await Promise.all([read('src/admin.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  assert.match(admin,/const costPlanEntries=/);
  assert.match(admin,/function openCostPlanDetails/);
  for(const label of ['Registros encontrados','Localizado nos caixas','Data','Caixa','Descrição','Valor','Nenhum lançamento registrado nesta categoria e neste mês.'])assert.ok(admin.includes(label));
  assert.match(admin,/expenseKind\(record\.description\)===category/);
  assert.match(admin,/openCostPlanDetails\(row\.dataset\.costCategory\)/);
  assert.match(style,/\.cost-plan-detail-popup/);
  assert.match(index,/admin\.js\?v=20260924-6/);

});

test('plano de custos permite informar e salvar valores já pagos',async()=>{
  const [admin,supabase,index,worker]=await Promise.all([read('src/admin.js'),read('src/supabase.js'),read('index.html'),read('public/sw.js')]);
  for(const label of ['Total pago','Saldo a pagar','Valor pago no plano','Salvar valores do plano de custos'])assert.ok(admin.includes(label));
  assert.match(admin,/class="cost-plan-paid"/);
  assert.match(admin,/paid:Number\(row\.querySelector\('\.cost-plan-paid'\)\.value\)\|\|0/);
  assert.match(admin,/não cria uma nova saída no caixa/);
  assert.match(supabase,/paid:item\?\.paid===null\|\|item\?\.paid===undefined\?null/);
  assert.match(index,/admin\.js\?v=20260924-6/);

});

test('ano e cor são obrigatórios na nova entrada',async()=>{
  const [main,index,worker]=await Promise.all([read('src/main.js'),read('index.html'),read('public/sw.js')]);
  assert.match(main,/function requireVehicleYearAndColor/);
  assert.match(main,/\['year','Ano \*'\],\['color','Cor \*'\]/);
  assert.match(main,/input\.required=true/);
  assert.match(index,/main\.js\?v=20260918-1/);

});

test('telefone cadastrado abre seleção entre veículo existente e novo veículo',async()=>{
  const [main,style,index,worker]=await Promise.all([read('src/main.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  assert.match(main,/function clientVehiclePopup/);
  assert.match(main,/clientId===client\.id/);
  for(const label of ['CLIENTE LOCALIZADO','Incluir este veículo','Incluir novo veículo','Nenhum veículo cadastrado para este cliente.'])assert.ok(main.includes(label));
  assert.match(main,/clientVehiclePopup\(client,input\)/);
  assert.match(style,/\.entry-client-vehicles/);
  assert.match(index,/main\.js\?v=20260918-1/);

});

test('clientes e veículos possuem pesquisa imediata pelos campos solicitados',async()=>{
  const [main,style,index,worker]=await Promise.all([read('src/main.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  for(const label of ['Pesquisar por nome, telefone, CPF ou endereço','Pesquisar por marca, modelo ou placa','Nenhum resultado'])assert.ok(main.includes(label));
  assert.match(main,/id="peopleSearch"/);
  assert.match(main,/data-person-search/);
  assert.match(main,/event\.target\?\.id!==['"]peopleSearch['"]/);
  assert.match(main,/card\.hidden=!match/);
  assert.match(style,/\.people-toolbar/);
  assert.match(index,/main\.js\?v=20260918-1/);

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
  assert.ok(workflow.includes('SOLICITAÇÃO DE ORÇAMENTO DE PEÇAS'));
  assert.match(workflow,/request\.vehicle\?\.plate,request\.vehicle\?\.model,request\.vehicle\?\.year/);
  assert.match(workflow,/navigator\.clipboard\.writeText/);
  assert.match(workflow,/CortezAndroid\?\.shareTextToWhatsApp/);
  assert.match(workflow,/partRequestNotifications/);
  assert.match(supabase,/export async function savePartRequest/);
  assert.match(supabase,/entidade:'solicitacao_pecas'/);
  assert.match(supabase,/export async function readPartRequests/);
  assert.match(supabase,/export async function markPartRequestSent/);
  assert.match(supabase,/export async function updatePartRequest/);
  assert.match(supabase,/export async function deletePartRequest/);
  assert.match(workflow,/Motivo \(opcional\)/);
  assert.match(workflow,/Reenviar para o fornecedor/);
  assert.match(workflow,/edit-part-request/);
  assert.match(workflow,/delete-part-request/);
  assert.match(workflow,/items\.some\(item=>item\.quantity<1\|\|!item\.description\)/);
  assert.match(access,/:not\(#toggleOrderChecklist\)/);
  assert.match(style,/\.part-request-row/);
  assert.match(style,/#requestParts\{background:#f2c500/);
  assert.match(activity,/shareTextToWhatsApp/);
  assert.match(activity,/shareTextToWhatsApp[\s\S]*?setPackage\("com\.whatsapp"\)[\s\S]*?setPackage\("com\.whatsapp\.w4b"\)/);
  assert.match(index,/order-workflow\.js\?v=20260918-1/);
  assert.match(index,/access-control\.js\?v=20260915-1/);

});

test('APK recupera falha de carregamento e não bloqueia a abertura com permissões',async()=>{
  const [activity,gradle,workflow,agenda,index]=await Promise.all([read('android/app/src/main/java/com/cortezgarage/app/MainActivity.java'),read('android/app/build.gradle'),read('.github/workflows/android-apk.yml'),read('src/agenda-enhancements.js'),read('index.html')]);
  assert.match(activity,/FALLBACK_URL = "https:\/\/cortezgaragemecanica-spec\.github\.io\/cortez-garage-app\/"/);
  assert.match(activity,/onReceivedError/);
  assert.match(activity,/onReceivedHttpError/);
  assert.match(activity,/recoverAppLoad/);
  assert.match(activity,/Tentar novamente/);
  assert.match(activity,/view\.postDelayed/);
  assert.match(activity,/APK_CACHE_VERSION = "116"/);
  assert.doesNotMatch(activity,/super\.onCreate\(state\);\s*if \(Build\.VERSION\.SDK_INT >= 33[\s\S]*?requestPermissions/);
  assert.match(activity,/@JavascriptInterface public void requestNotificationPermission/);
  assert.match(activity,/requestCode == NOTIFICATION_REQUEST/);
  assert.match(agenda,/CortezAndroid\?\.requestNotificationPermission/);
  assert.match(index,/agenda-enhancements\.js\?v=20260914-1/);
  assert.match(gradle,/versionCode 15/);
  assert.match(gradle,/versionName '1\.0\.15'/);
  assert.match(workflow,/android-v1\.0\.15/);
});

test('ações restritas da O.S. ficam somente com o proprietário e Voltar fecha solicitação de peças',async()=>{
  const [orderWorkflow,technical,activity,index]=await Promise.all([read('src/order-workflow.js'),read('src/technical-report.js'),read('android/app/src/main/java/com/cortezgarage/app/MainActivity.java'),read('index.html')]);
  assert.match(orderWorkflow,/if\(owner\(\)&&!document\.querySelector\('#advanceOs'\)\)/);
  assert.match(orderWorkflow,/if\(!owner\(\)\)\{document\.querySelector\('#openClosing'\)\?\.remove\(\);return\}/);
  assert.match(technical,/const OWNER='cortezgaragemecanica@gmail\.com'/);
  assert.match(technical,/function openTab\(order\)\{if\(owner\(\)&&order\)/);
  assert.match(technical,/if\(!owner\(\)\)\{document\.querySelector\('#openTechnicalReport'\)\?\.remove\(\)/);
  assert.match(activity,/modal\.querySelector\('\.part-request-editor,\.part-request-list'\)/);
  assert.match(activity,/webView\.evaluateJavascript\(closePartRequest/);
  assert.match(index,/technical-report\.js\?v=20260914-1/);
});

test('campo Serviços a executar passa a se chamar Observação',async()=>{
  const [workflow,pdf,index]=await Promise.all([read('src/order-workflow.js'),read('src/pdf-order.js'),read('index.html')]);
  assert.match(workflow,/label&&label\.textContent!=='Observação'/);
  assert.match(workflow,/placeholder='Digite uma observação sobre o serviço'/);
  assert.match(workflow,/field&&field\.placeholder!==placeholder/);
  assert.match(pdf,/paragraph\('Observação',order\.services\)/);
  assert.doesNotMatch(pdf,/Serviços a executar/);
  assert.match(index,/order-workflow\.js\?v=20260918-1/);
  assert.match(index,/pdf-order\.js\?v=20260915-2/);
});

test('proprietário altera o markup de todas as peças da O.S.',async()=>{
  const [budget,style,index,worker]=await Promise.all([read('src/budget-order.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  assert.match(budget,/owner\(\)\?'<button type="button" class="secondary" id="changeAllMarkup"/);
  assert.match(budget,/function bulkMarkupPopup/);
  assert.match(budget,/Alterar markup de todas as peças/);
  assert.match(budget,/const rows=\[\.\.\.document\.querySelectorAll\('#partsRows tr'\)\]/);
  assert.match(budget,/value=cost\*\(1\+markup\/100\)/);
  assert.match(budget,/querySelector\('\[data-field="margin"\]'\)\.value=markup/);
  assert.match(budget,/autoSave\(\)/);
  assert.match(style,/\.budget-part-actions/);
  assert.match(index,/budget-order\.js\?v=20260922-1/);
  assert.match(worker,/budget-order\.js\?v=20260922-1/);
});

test('painel inicial mostra O.S. abertas modificadas sem regravar as demais',async()=>{
  const [main,supabase,index,worker]=await Promise.all([read('src/main.js'),read('src/supabase.js'),read('index.html'),read('public/sw.js')]);
  assert.match(main,/const recent=visibleOrders\(\)\.filter\(order=>order\.status!=='Entregue'\)\.sort\(\(a,b\)=>new Date\(b\.updatedAt\|\|b\.created\)-new Date\(a\.updatedAt\|\|a\.created\)\)/);
  assert.doesNotMatch(main,/open=allOrders\.filter\(order=>status\(order\)!=='entregue'\)/);
  assert.match(main,/Ordens modificadas recentemente/);
  assert.match(main,/<th>Atualização<\/th>/);
  assert.match(main,/new Date\(o\.updatedAt\|\|o\.created\)\.toLocaleString\('pt-BR'\)/);
  assert.match(supabase,/changedRows=rows\.filter\(row=>/);
  assert.match(supabase,/orderContentFingerprint\(row\)!==orderContentFingerprint\(remote\)/);
  assert.match(supabase,/upsert\(token,'ordens_servico',changedRows,'numero'\)/);
  assert.doesNotMatch(supabase,/upsert\(token,'ordens_servico',rows,'numero'\)/);
  assert.match(index,/main\.js\?v=20260918-1/);
  assert.match(worker,/main\.js\?v=20260918-1/);
});

test('mecânico solicita orçamento de serviços e proprietário vê a tabela',async()=>{
  const [service,supabase,style,index,worker]=await Promise.all([read('src/service-quote-requests.js'),read('src/supabase.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  assert.match(service,/parts\.insertAdjacentElement\('afterend',button\)/);
  assert.match(service,/Solicitar orçamento de serviços/);
  assert.match(service,/class="part-request-editor service-quote-editor"/);
  assert.match(service,/Solicitar e salvar/);
  assert.match(service,/saveServiceQuoteRequest\(order,items\)/);
  for(const label of ['O.S.','Veículo','Solicitado por','Data','Serviços solicitados'])assert.ok(service.includes(label));
  assert.match(service,/acknowledgeServiceQuoteRequests\(pending\.map/);
  assert.match(service,/id='serviceQuoteNotifications'/);
  assert.match(supabase,/export async function saveServiceQuoteRequest/);
  assert.match(supabase,/entidade:'solicitacao_orcamento_servicos'/);
  assert.match(supabase,/export async function readServiceQuoteRequests/);
  assert.match(style,/#requestServiceQuote/);
  assert.match(index,/service-quote-requests\.js\?v=20260918-1/);
  assert.match(worker,/service-quote-requests\.js\?v=20260918-1/);
});

test('proprietário precifica a solicitação e envia os serviços para a O.S. sem duplicar',async()=>{
  const[service,supabase,budget,style,index,worker]=await Promise.all(['src/service-quote-requests.js','src/supabase.js','src/budget-order.js','src/style.css','index.html','public/sw.js'].map(file=>readFile(file,'utf8')));
  for(const label of ['Abrir solicitação','Descrição do serviço','Mecânico','Valor total','Enviar para a O.S.'])assert.ok(service.includes(label));
  assert.match(service,/function preferredMechanic\(request\)/);
  assert.match(service,/sendServiceQuoteToOrder\(request\.id,items\)/);
  assert.match(service,/applyImportedOrder\(result,request\)/);
  assert.match(service,/request\.importedAt\?'Enviada para O\.S\.'/);
  assert.match(supabase,/export async function sendServiceQuoteToOrder\(requestId,items\)/);
  assert.match(supabase,/Somente o proprietário pode enviar solicitações/);
  assert.match(supabase,/orderRow\.status==='Entregue'/);
  assert.match(supabase,/sourceRequestId:requestId/);
  assert.match(supabase,/filter\(item=>item\.sourceRequestId===requestId\)/);
  assert.match(supabase,/if\(alreadyImported\.length\)/);
  assert.match(supabase,/status:'Enviada para O\.S\.'/);
  assert.match(supabase,/mao_obra:servicesTotal,valor_pecas:partsTotal,total/);
  assert.match(service,/cortez:service-quote-imported/);
  assert.match(budget,/cortez:service-quote-imported/);
  assert.match(style,/\.service-quote-pricing-row/);
  assert.match(index,/style\.css\?v=20260924-4/);
  assert.match(index,/budget-order\.js\?v=20260922-1/);
  assert.match(index,/service-quote-requests\.js\?v=20260918-1/);
  assert.match(worker,/supabase\.js\?v=20260918-1/);

});

test('solicitações de serviços ficam no histórico da O.S. fora do PDF e aviso do dono reaparece',async()=>{
  const [service,style,pdf,index]=await Promise.all([read('src/service-quote-requests.js'),read('src/style.css'),read('src/pdf-order.js'),read('index.html')]);
  assert.match(service,/request\.orderId===order\.id/);
  assert.match(service,/id="serviceQuoteHistory"/);
  assert.match(service,/await renderOrderHistory\(true\)/);
  assert.match(service,/renderNotification\(\);if\(loading\|\|\(!force&&Date\.now\(\)-loadedAt<30000\)\)return/);
  assert.match(service,/id='serviceQuoteDashboardAlert'/);
  assert.match(service,/menu\.insertAdjacentElement\('afterend',panel\)/);
  assert.doesNotMatch(pdf,/serviceQuoteHistory|solicitacao_orcamento_servicos/);
  assert.match(style,/@media print\{#serviceQuoteHistory/);
  assert.match(index,/service-quote-requests\.js\?v=20260918-1/);
});

test('botão de solicitar orçamento de serviços aparece em azul',async()=>{
  const [style,index,worker]=await Promise.all([read('src/style.css'),read('index.html'),read('public/sw.js')]);
  assert.match(style,/#requestServiceQuote\{[^}]*background:#1764c8;[^}]*color:#fff/);
  assert.match(index,/style\.css\?v=20260924-4/);
  assert.match(worker,/style\.css\?v=20260923-2/);

});

test('somente o proprietário exclui solicitação de orçamento de serviços no banco',async()=>{
  const [service,supabase,index,worker]=await Promise.all([read('src/service-quote-requests.js'),read('src/supabase.js'),read('index.html'),read('public/sw.js')]);
  assert.match(service,/owner\(\)\?deleteButton\(request\):''/);
  assert.match(service,/class="danger delete-service-quote"/);
  assert.match(service,/if\(!owner\(\)\)return;const requestId=button\.dataset\.requestId/);
  assert.match(service,/confirm\('Excluir permanentemente esta solicitação/);
  assert.match(service,/await deleteServiceQuoteRequest\(requestId\)/);
  assert.match(supabase,/export async function deleteServiceQuoteRequest/);
  assert.match(supabase,/if\(currentEmail\(\)!==OWNER_EMAIL\)throw new Error\('Somente o proprietário pode excluir/);
  assert.match(supabase,/entidade=eq\.solicitacao_orcamento_servicos&registro_id=eq/);
  assert.match(supabase,/method:'DELETE',prefer:'return=representation'/);
  assert.match(index,/service-quote-requests\.js\?v=20260918-1/);
  assert.match(worker,/supabase\.js\?v=20260915-3/);

});

test('painel de solicitações de peças fica junto ao de orçamentos de serviços no início',async()=>{
  const [workflow,service,style,index,worker]=await Promise.all([read('src/order-workflow.js'),read('src/service-quote-requests.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  assert.match(workflow,/id='partRequestDashboardAlert'/);
  assert.match(workflow,/if\(!canHandleRequestNotifications\(\)\)\{button\?\.remove\(\);panel\?\.remove\(\);return\}/);
  assert.match(workflow,/document\.querySelector\('#serviceQuoteDashboardAlert'\)\|\|menu/);
  assert.match(workflow,/panel\.onclick=openPartRequestsFromDashboard/);
  assert.match(workflow,/partRequests=await readPartRequests\(\)/);
  assert.match(workflow,/renderPartRequestNotification\(\);if\(partRequestsLoading\|\|/);
  assert.match(service,/id='serviceQuoteDashboardAlert'/);
  assert.match(style,/\.part-request-dashboard-alert\{/);
  assert.match(index,/order-workflow\.js\?v=20260918-1/);
  assert.match(worker,/order-workflow\.js\?v=20260918-1/);

});

test('solicitações de peças enviadas ficam recolhidas em Já enviadas e abrem ao clicar',async()=>{
  const [workflow,supabase,style,index,worker]=await Promise.all([read('src/order-workflow.js'),read('src/supabase.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  assert.match(supabase,/status:'Enviada',sentAt:/);
  assert.match(workflow,/pending=partRequests\.filter\(request=>request\.status==='Pendente'\)/);
  assert.match(workflow,/<details class="part-request-archive"><summary>Já enviadas/);
  assert.match(workflow,/archive\.addEventListener\('toggle',\(\)=>\{if\(!archive\.open\)return/);
  assert.match(workflow,/sent=partRequests\.filter\(request=>request\.status==='Enviada'\)/);
  assert.match(workflow,/wirePartRequestButtons\(archive\)/);
  assert.match(workflow,/showPartRequestNotifications\(wasSent&&archiveOpen\)/);
  assert.match(workflow,/modal\.classList\.add\('part-request-notifications-view'\)/);
  assert.match(workflow,/archiveSentPartRequestsInOrder\(\)/);
  assert.match(workflow,/archive\.querySelector\('\.part-request-list'\)\.append\(\.\.\.sentCards\)/);
  assert.match(workflow,/Reenviar para o fornecedor/);
  assert.match(style,/\.part-request-archive summary\{/);
  assert.match(index,/order-workflow\.js\?v=20260918-1/);

});

test('solicitações de serviços e peças ocupam a tela inteira no computador',async()=>{
  const [style,index,worker]=await Promise.all([read('src/style.css'),read('index.html'),read('public/sw.js')]);
  assert.match(style,/@media\(min-width:701px\)/);
  assert.match(style,/\.os-workflow-modal:has\(\.part-request-editor\)/);
  assert.match(style,/\.os-workflow-modal:has\(\.part-request-list\)/);
  assert.match(style,/\.service-quote-modal>\.check-popup-card\{[^}]*width:100%[^}]*height:calc\(100dvh - 28px\)[^}]*max-height:none/);
  assert.match(style,/\.service-quote-owner-list[^}]*flex:1[^}]*overflow:auto/);
  assert.match(index,/style\.css\?v=20260924-4/);
  assert.match(worker,/style\.css\?v=20260923-2/);

});

test('proprietário altera internamente as comissões abertas sem mudar pagamentos ou textos exibidos',async()=>{
  const [admin,reports,supabase,index,worker]=await Promise.all([read('src/admin.js'),read('src/reports.js'),read('src/supabase.js'),read('index.html'),read('public/sw.js')]);
  assert.match(admin,/id="editPartnerRates">Alterar comissões dos sócios/);
  assert.match(admin,/function openPartnerRatePopup/);
  assert.match(admin,/await savePartnerCommissionRates\(currentWeek\.start,\{Fabiano:fabiano\/100,Marcelino:marcelino\/100\}\)/);
  assert.match(admin,/revalueOpenPartnerCommission\(ledger,currentRates\[partner\]\)/);
  assert.match(admin,/Pagamentos já arquivados não são alterados/);
  assert.match(admin,/rates=partnerRatesForDate\(date\)/);
  assert.match(admin,/allocation\*rates\.Fabiano/);
  assert.match(admin,/allocation\*rates\.Marcelino/);
  assert.match(admin,/partnerRateWeeks\[commissionWeek/);
  assert.match(admin,/PARTNER_DISPLAY_RATES=\{Fabiano:\.25,Marcelino:\.2\}/);
  assert.match(admin,/readPartnerCommissionRates\(\)/);
  assert.match(reports,/partnerRatesForWeek=range=>partnerRateWeeks\[range\.start\]/);
  assert.match(reports,/Math\.max\(0,profit\)\*rates\.Marcelino/);
  assert.match(reports,/Math\.max\(0,profit\)\*rates\.Fabiano/);
  assert.match(reports,/Marcelino · 20%/);
  assert.match(reports,/Fabiano · 25%/);
  assert.match(supabase,/export async function savePartnerCommissionRates/);
  assert.match(supabase,/Somente o proprietário pode alterar as comissões dos sócios/);
  assert.match(supabase,/partnerCommissionRatesByWeek:weeks/);
  assert.match(supabase,/weekStart!==partnerCommissionWeekStart\(\)/);
  assert.match(supabase,/A comissão só pode ser alterada para a semana atual/);
  assert.match(index,/admin\.js\?v=20260924-6/);
  assert.match(index,/reports\.js\?v=20260918-1/);
  assert.match(worker,/supabase\.js\?v=20260918-1/);

});

test('baixa de conta a receber pergunta o caixa e registra a entrada escolhida',async()=>{
  const [admin,supabase,index,worker]=await Promise.all(['src/admin.js','src/supabase.js','index.html','public/sw.js'].map(file=>readFile(file,'utf8')));
  assert.match(admin,/function openReceivableSettlement\(record\)/);
  for(const label of ['RECEBER CONTA','Caixa de entrada','Banco do Brasil','Mercado Livre','Dinheiro','Dar baixa e lançar no caixa'])assert.ok(admin.includes(label));
  assert.match(admin,/markFinanceDone\(record\.id,account\)/);
  assert.match(admin,/activeCashAccount=account/);
  assert.match(supabase,/markFinanceDone\(id,cashAccount=['"]['"]\)/);
  assert.match(supabase,/Selecione o caixa em que o valor foi recebido/);
  assert.match(supabase,/forma_pagamento:cashAccount/);
  assert.match(index,/admin\.js\?v=20260924-6/);
  assert.match(worker,/supabase\.js\?v=20260923-2/);
  assert.match(worker,/cortez-garage-v228/);
});

test('painel soma comissões e abre janela ampla com totais e tabelas detalhadas',async()=>{
  const [admin,style,index,worker]=await Promise.all(['src/admin.js','src/style.css','index.html','public/sw.js'].map(file=>readFile(file,'utf8')));
  assert.match(admin,/commissions:mechanicCommissions\+partnerCommissions/);
  assert.match(admin,/class="commission-total-card" role="button" tabindex="0"/);
  assert.match(admin,/Total de comissões a pagar/);
  assert.match(admin,/Sócios \+ mecânicos · Clique para detalhar/);
  assert.match(admin,/function openCommissionSummary\(\)/);
  assert.match(admin,/\['partners','Comissões dos sócios',total\.partnerCommissions\]/);
  assert.match(admin,/\['mechanics','Comissões dos mecânicos',total\.mechanicCommissions\]/);
  assert.match(admin,/function openCommissionPeople\(group\)/);
  assert.match(admin,/function openCommissionPersonDetails\(group,name\)/);
  assert.match(admin,/function commissionMechanicDetails\(name\)/);
  assert.match(admin,/class="commission-summary-card"/);
  assert.match(admin,/class="commission-person-card"/);
  for(const label of ['Ver tabela completa','Já abatido','Vale / abatimento','Saldo acumulado'])assert.ok(admin.includes(label));
  assert.match(admin,/partnerCommissionLedger\(name\)\.outstandingTotal/);
  assert.match(admin,/mechanicCommissionState\(name\)\.total/);
  assert.match(admin,/wireCommissionSummary\(\)/);
  assert.match(style,/\.commission-total-card/);
  assert.match(style,/\.commission-summary-popup \.check-popup-card/);
  assert.match(style,/width:min\(1180px/);
  assert.match(style,/\.commission-summary-card b/);
  assert.match(index,/style\.css\?v=20260924-4/);
  assert.match(index,/admin\.js\?v=20260924-6/);
  assert.match(worker,/cortez-garage-v228/);
});

