import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{commissionWeekStart,hasSaturdaySchedule,mechanicWorksOnDate,previousCommissionWeekStart,shouldRollSaturdayCommission}from'../src/mechanic-saturday.js';
import{planMechanicCommissionSettlements}from'../src/commission-settlement.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('somente Gustavo e Tony possuem agenda aos sábados',()=>{
  assert.equal(hasSaturdaySchedule('Gustavo'),true);
  assert.equal(hasSaturdaySchedule('Tony'),true);
  assert.equal(hasSaturdaySchedule('Fábio'),false);
  assert.equal(mechanicWorksOnDate('Gustavo','2026-10-03'),true);
  assert.equal(mechanicWorksOnDate('Tony','2026-10-03'),true);
  assert.equal(mechanicWorksOnDate('Fabio','2026-10-03'),false);
  assert.equal(mechanicWorksOnDate('Gustavo','2026-10-04'),false);
});

test('sábado permanece no fechamento anterior apenas quando ainda há saldo pendente',()=>{
  assert.equal(commissionWeekStart('2026-10-03'),'2026-10-03');
  assert.equal(previousCommissionWeekStart('2026-10-03'),'2026-09-26');
  assert.equal(shouldRollSaturdayCommission('Gustavo','2026-10-03',true),true);
  assert.equal(shouldRollSaturdayCommission('Tony','2026-10-03',true),true);
  assert.equal(shouldRollSaturdayCommission('Gustavo','2026-10-03',false),false);
  assert.equal(shouldRollSaturdayCommission('Fabio','2026-10-03',true),false);
});

test('pagamento de sábado quita o fechamento anterior prorrogado',()=>{
  const rows=[
    {id:'sexta',categoria:'Comissões',movimento:'Saída',descricao:'Comissão sexta',valor:100,vencimento:'2026-10-02',status:'Pendente',mecanico:'Gustavo',semana_inicio:'2026-09-26'},
    {id:'sabado',categoria:'Comissões',movimento:'Saída',descricao:'Comissão sábado',valor:50,vencimento:'2026-10-03',status:'Pendente',mecanico:'Gustavo',semana_inicio:'2026-09-26'},
    {id:'pagamento',categoria:'Fluxo de caixa',movimento:'Saída',descricao:'Pagamento comissões Gustavo',valor:150,vencimento:'2026-10-03',status:'Realizado'}
  ];
  const plan=planMechanicCommissionSettlements(rows,['Gustavo','Tony']);
  assert.deepEqual(plan.fullIds,['sexta','sabado']);
});

test('sábado inicia novo fechamento quando a sexta já foi paga',()=>{
  const rows=[
    {id:'sexta-paga',categoria:'Comissões',movimento:'Saída',descricao:'Comissão sexta',valor:100,vencimento:'2026-10-02',status:'Realizado',mecanico:'Tony',semana_inicio:'2026-09-26'},
    {id:'sabado-novo',categoria:'Comissões',movimento:'Saída',descricao:'Comissão sábado',valor:50,vencimento:'2026-10-03',status:'Pendente',mecanico:'Tony',semana_inicio:'2026-10-03'},
    {id:'pagamento-sabado',categoria:'Fluxo de caixa',movimento:'Saída',descricao:'Pagamento comissões Tony',valor:50,vencimento:'2026-10-03',status:'Realizado'}
  ];
  const plan=planMechanicCommissionSettlements(rows,['Gustavo','Tony']);
  assert.deepEqual(plan.fullIds,['sabado-novo']);
});

test('agenda e banco aplicam sábado somente a Gustavo e Tony',async()=>{
  const[agenda,enhancements,supabase,sql,index,worker]=await Promise.all([
    'src/agenda.js','src/agenda-enhancements.js','src/supabase.js','supabase/comissoes-sabado-gustavo-tony.sql','index.html','public/sw.js'
  ].map(read));
  assert.match(agenda,/Array\.from\(\{length:6\}/);
  assert.match(agenda,/mechanicsForDay/);
  assert.match(agenda,/Gustavo e Tony também aos sábados/);
  assert.match(enhancements,/mechanicWorksOnDate/);
  assert.match(supabase,/applySaturdayCommissionRollover/);
  assert.match(sql,/nome in \('gustavo', 'tony'\)/);
  assert.match(sql,/sexta ou sábado/);
  assert.match(sql,/Sábado é exclusivo das agendas de Gustavo e Tony/);
  assert.match(index,/agenda\.js\?v=20261003-1/);
  assert.match(worker,/cortez-garage-v242-saturday-commissions-agenda/);
});
