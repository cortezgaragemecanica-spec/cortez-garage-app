import{onUiUpdated}from'./ui-events.js?v=20260930-1';

const sections=[
  {id:'primeiros-passos',title:'1. Primeiros passos',summary:'Acesso, atualização e sincronização',content:`
    <p>Use um usuário individual em cada celular. O acesso fica salvo no aparelho e as permissões são definidas pelo proprietário.</p>
    <ol><li>Abra o aplicativo com internet.</li><li>Informe e-mail e senha.</li><li>Aguarde <b>Preparando a oficina</b> e a indicação <b>Banco atualizado</b>.</li></ol>
    <div class="help-note"><b>Atualização automática:</b> ao receber uma nova versão, o aplicativo limpa apenas arquivos temporários. Ordens, clientes e estoque continuam preservados no banco.</div>`},
  {id:'inicio',title:'2. Página inicial',summary:'Atalhos e fluxo da oficina',content:`
    <p>A tela inicial resume as O.S. ativas, os veículos prontos e a hora da última sincronização.</p>
    <ul><li><b>Acesso rápido:</b> O.S., Financeiro, Comissões, Estoque, Agenda e Relatórios.</li><li><b>O que precisa de atenção:</b> abre diretamente cada etapa do fluxo.</li><li><b>Atividade recente:</b> mostra as últimas ordens alteradas.</li></ul>`},
  {id:'nova-entrada',title:'3. Nova entrada',summary:'Cliente, veículo, checklist e comprovante',content:`
    <ol><li>Toque em <b>Nova Entrada</b>.</li><li>Localize o cliente pelo telefone ou preencha seus dados.</li><li>Escolha um veículo existente ou cadastre placa, modelo, ano, cor, quilometragem e combustível.</li><li>Registre a reclamação e marque o checklist.</li><li>Revise e salve. A confirmação só aparece depois da gravação no banco.</li></ol>
    <p>O comprovante de entrada pode ser salvo em PDF e enviado ao cliente pelo WhatsApp.</p>`},
  {id:'fluxo-os',title:'4. Fluxo da ordem de serviço',summary:'Do diagnóstico à entrega',content:`
    <div class="help-flow"><span>Aguardando diagnóstico</span><i>→</i><span>Aguardando aprovação</span><i>→</i><span>Em andamento</span><i>→</i><span>Pronto para entrega</span><i>→</i><span>Entregue</span></div>
    <ul><li><b>Aguardando peça:</b> use quando o serviço estiver parado por falta de material.</li><li><b>Orçamento fora do pátio:</b> proposta feita sem o veículo permanecer na oficina.</li><li><b>Recusado:</b> orçamento não aprovado.</li></ul>
    <p>Use os filtros da tela de O.S. para encontrar número, cliente, placa ou modelo.</p>`},
  {id:'diagnostico',title:'5. Diagnóstico e observações',summary:'Textos técnicos e revisão',content:`
    <p>O proprietário pode gravar diretamente o diagnóstico e as observações. Mecânicos enviam os textos para revisão, evitando alterações indevidas na O.S.</p>
    <ol><li>Abra a O.S.</li><li>Preencha diagnóstico e observação.</li><li>Salve ou envie para revisão, conforme o seu perfil.</li><li>Confira o PDF antes de encaminhar ao cliente.</li></ol>`},
  {id:'orcamento',title:'6. Orçamento, peças e serviços',summary:'Valores, mecânico e aprovação',content:`
    <ul><li>Adicione cada peça com descrição, marca, quantidade, custo, margem e fornecedor.</li><li>Adicione cada serviço com descrição, valor, mecânico e percentual de comissão.</li><li>Marque itens recusados sem apagá-los do histórico.</li><li>Informe condições de pagamento e garantia.</li><li>O acréscimo de 10% é opcional. Quando ativado, ele é aplicado somente às peças; a mão de obra permanece sem acréscimo, inclusive no PDF.</li></ul>
    <p>Mecânicos podem solicitar peças ou um orçamento de serviços. O proprietário recebe o aviso na página inicial.</p>`},
  {id:'pronto-entrega',title:'7. Pronto para entrega',summary:'Salvamento, estoque e conta a receber',content:`
    <ol><li>Confira todas as peças, serviços e valores.</li><li>Toque em <b>Veículo pronto para entrega</b>.</li><li>Aguarde a confirmação do banco.</li></ol>
    <p>Essa etapa salva a O.S., baixa automaticamente apenas as peças escolhidas no <b>Estoque da oficina</b> e cria a conta a receber. Compras usadas diretamente na O.S. não alteram o estoque físico.</p>`},
  {id:'fechamento-os',title:'8. Fechamento e pagamento',summary:'Dinheiro, Pix, cartão, prazo e garantia',content:`
    <ul><li><b>À vista:</b> registre o caixa escolhido.</li><li><b>Cartão de crédito:</b> escolha 1x a 10x; a taxa é calculada e reduz o valor líquido da oficina.</li><li><b>A prazo:</b> informe parcelas e vencimentos; cada parcela vai para Contas a Receber.</li><li><b>Garantia:</b> zera a cobrança do cliente e permite decidir se haverá comissão.</li></ul>
    <p>Depois da entrega, gere o recibo e confira o valor efetivamente pago.</p>`},
  {id:'comissoes',title:'9. Comissões',summary:'Mecânicos, sócios, vales e conferência',content:`
    <p>As comissões dos mecânicos nascem dos serviços da O.S. e podem ser liberadas antecipadamente por serviço ou geradas no fechamento.</p>
    <ul><li>Gustavo e Tony trabalham no período de segunda a sábado.</li><li>O botão de conferência deles fica disponível de sexta às 17h até sábado às 18h.</li><li>Vales realizados são descontados do fechamento da semana.</li><li>Pagamentos arquivados ficam agrupados por mês.</li><li>Comissões dos sócios consideram o lucro reconhecido sobre valores recebidos.</li></ul>`},
  {id:'estoque',title:'10. Estoque',summary:'Estoque físico, peças novas ou usadas e balanço',content:`
    <ul><li><b>Estoque físico:</b> contém somente peças realmente guardadas na oficina, sempre com código e condição Nova ou Usada.</li><li><b>Uso na O.S.:</b> escolha Buscar no estoque, pesquise e selecione o item cadastrado; não é possível digitá-lo livremente.</li><li><b>Inserir manualmente:</b> preencha a peça sem código e sem movimentar o estoque físico. Para usar uma peça guardada na oficina, escolha <b>Buscar no estoque</b>.</li><li><b>Balanço:</b> conte as peças, informe o saldo encontrado e salve as diferenças.</li></ul>
    <div class="help-warning"><b>Atenção:</b> ao marcar a O.S. como pronta, não aparece mais uma pergunta de baixa. Somente os itens já selecionados do estoque físico são baixados automaticamente.</div>`},
  {id:'financeiro',title:'11. Financeiro',summary:'Caixa, contas, custos e fechamento mensal',content:`
    <ul><li><b>Fluxo de caixa:</b> entradas e saídas realizadas.</li><li><b>Contas a receber:</b> pendentes, edição e arquivo das recebidas.</li><li><b>Contas a pagar:</b> pesquisa, agrupamento, pagamento parcial e arquivo.</li><li><b>Plano de custos:</b> aluguel, água, luz, internet, segurança e demais compromissos.</li><li><b>Fechamento mensal:</b> faturamento, custos, lucro, pessoas e fornecedores, com geração de PDF.</li></ul>
    <p>Para usuários autorizados que não sejam proprietários, o Financeiro é somente leitura.</p>`},
  {id:'fornecedores',title:'12. Acerto Luizinho e devoluções',summary:'Histórico de compras separado do estoque',content:`
    <ol><li>Cadastre a nota em qualquer dia da semana, com número, data, veículo opcional e todos os itens.</li><li>Confira cada nota com o documento do fornecedor.</li><li>Consulte as peças, descrições e valores em <b>Estoque → Compras Luizinho</b>.</li><li>Use uma devolução para agrupar um ou mais itens e reduzir o acerto.</li></ol>
    <p>Notas e devoluções do Luizinho formam um histórico financeiro independente e não movimentam o estoque físico. Semanas anteriores ficam arquivadas.</p>`},
  {id:'agenda',title:'13. Agenda',summary:'Atendimentos, sábados e privacidade',content:`
    <ul><li>Abra Agenda e escolha o mecânico e o horário.</li><li>Gustavo e Tony possuem agenda também aos sábados.</li><li>A agenda Cortez Atendimento Externo é exclusiva do proprietário.</li><li>Agendamentos anteriores ficam arquivados para consulta.</li></ul>
    <p>A agenda semanal também pode ser salva em PDF.</p>`},
  {id:'clientes-veiculos',title:'14. Clientes e veículos',summary:'Pesquisa e histórico completo',content:`
    <p>Pesquise clientes por nome, telefone ou CPF e veículos por placa, modelo ou proprietário. O histórico do veículo reúne O.S., serviços, peças, valores, mecânicos e checklists realizados.</p>
    <p>Excluir um cadastro não apaga o histórico das O.S. já registradas.</p>`},
  {id:'relatorios',title:'15. Relatórios e PDFs',summary:'Documentos operacionais e financeiros',content:`
    <ul><li>O.S. e orçamento do cliente.</li><li>Comprovante de entrada e recibo de fechamento.</li><li>Agenda semanal.</li><li>Caixa, contas, faturamento e comissões.</li><li>Fechamento mensal.</li></ul>
    <p>Antes de compartilhar, use a visualização para conferir diagnóstico, observações, valores e dados do veículo.</p>`},
  {id:'usuarios',title:'16. Usuários e permissões',summary:'Acessos controlados pelo proprietário',content:`
    <p>Em <b>Financeiro → Gerenciar usuários</b>, o proprietário controla acesso, entrada, edição de O.S., inclusão de itens, valores, ordens entregues, pronto para entrega, agenda e Financeiro.</p>
    <div class="help-warning"><b>Boa prática:</b> não compartilhe o usuário do proprietário. Bloqueie imediatamente acessos de aparelhos que não estejam mais em uso.</div>`},
  {id:'backup',title:'17. Backup e restauração',summary:'Cópia de segurança no computador',content:`
    <ol><li>Entre como proprietário pelo computador.</li><li>Abra o Financeiro e escolha a opção de backup.</li><li>Salve o arquivo em local seguro.</li></ol>
    <p>A restauração substitui os dados operacionais pelo conteúdo do arquivo e deve ser usada somente pelo proprietário, após conferir a data do backup.</p>`},
  {id:'solucao-problemas',title:'18. Solução de problemas',summary:'Atualização, banco pendente e dados antigos',content:`
    <dl><dt>A O.S. ou a comissão está desatualizada</dt><dd>Feche completamente o aplicativo, conecte o aparelho à internet e abra novamente. Aguarde o banco atualizar.</dd><dt>Aparece Banco pendente</dt><dd>Não repita a mesma alteração. Mantenha o aplicativo aberto com internet e tente sincronizar novamente.</dd><dt>A O.S. não foi encontrada</dt><dd>Volte para Ordens, aguarde a sincronização e reabra pelo número.</dd><dt>O botão não aparece</dt><dd>O recurso pode depender da permissão do usuário ou do status atual da O.S.</dd><dt>O PDF está incompleto</dt><dd>Salve a O.S., reabra-a e confira os campos antes de gerar novamente.</dd></dl>
    <div class="help-note"><b>Ao pedir suporte:</b> informe usuário, número da O.S., horário, tela utilizada e envie uma imagem do erro.</div>`}
];

const article=section=>`<article class="help-section" id="help-${section.id}" data-search="${section.title} ${section.summary}"><header><span>${section.summary}</span><h2>${section.title}</h2></header>${section.content}</article>`;

function closeHelp(){document.querySelector('.help-center')?.remove();document.body.classList.remove('help-open')}

function openHelp(){
  closeHelp();
  const modal=document.createElement('div');modal.className='help-center';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','helpTitle');
  modal.innerHTML=`<div class="help-shell"><header class="help-top"><div><span class="eyebrow">CENTRAL DE AJUDA</span><h1 id="helpTitle">Manual completo do Cortez Garage</h1><p>Versão do manual: 08/10/2026</p></div><div class="help-top-actions"><button class="secondary help-print">Imprimir / salvar PDF</button><button class="secondary help-close" aria-label="Fechar manual">×</button></div></header><div class="help-search"><label><span>Pesquisar no manual</span><input type="search" placeholder="Ex.: comissão, estoque, O.S., PDF…" autocomplete="off"></label><small><b>${sections.length}</b> assuntos encontrados</small></div><div class="help-layout"><nav class="help-toc" aria-label="Sumário do manual">${sections.map(section=>`<button data-help-target="${section.id}"><b>${section.title}</b><small>${section.summary}</small></button>`).join('')}</nav><main class="help-content">${sections.map(article).join('')}<div class="help-empty" hidden><b>Nenhum assunto encontrado</b><span>Tente pesquisar com outra palavra.</span></div></main></div></div>`;
  document.body.append(modal);document.body.classList.add('help-open');
  const search=modal.querySelector('input'),counter=modal.querySelector('.help-search small b'),empty=modal.querySelector('.help-empty');
  const filter=()=>{const term=search.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();let visible=0;modal.querySelectorAll('.help-section').forEach(section=>{const text=section.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),show=!term||text.includes(term);section.hidden=!show;if(show)visible++});modal.querySelectorAll('[data-help-target]').forEach(button=>{button.hidden=modal.querySelector(`#help-${button.dataset.helpTarget}`)?.hidden||false});counter.textContent=visible;empty.hidden=visible>0};
  search.addEventListener('input',filter);modal.querySelector('.help-close').onclick=closeHelp;modal.querySelector('.help-print').onclick=()=>window.print();modal.addEventListener('click',event=>{if(event.target===modal)closeHelp()});modal.querySelectorAll('[data-help-target]').forEach(button=>button.onclick=()=>modal.querySelector(`#help-${button.dataset.helpTarget}`)?.scrollIntoView({behavior:'smooth',block:'start'}));
  search.focus();
}

function installHelpButton(){const actions=document.querySelector('.header-actions');if(!actions||actions.querySelector('#openHelp'))return;const button=document.createElement('button');button.id='openHelp';button.className='secondary help-button';button.type='button';button.setAttribute('aria-label','Abrir manual e ajuda');button.innerHTML='<b>?</b><span>Ajuda</span>';button.onclick=openHelp;actions.insertBefore(button,actions.querySelector('#logout'))}

onUiUpdated(installHelpButton);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.querySelector('.help-center'))closeHelp()});
