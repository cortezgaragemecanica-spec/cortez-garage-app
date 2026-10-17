import test from'node:test';
import assert from'node:assert/strict';
import{partnerCommissionWeek,summarizePartnerCommissionWeek,expiredPartnerCommissionWeeks}from'../src/partner-week-summary.js';

const ledger={
  events:[
    {date:'2026-10-09',week:{start:'2026-10-05',end:'2026-10-10'},commission:100,paid:100,remaining:0},
    {date:'2026-10-15',week:{start:'2026-10-12',end:'2026-10-17'},commission:80,paid:20,remaining:60},
    {date:'2026-10-16',week:{start:'2026-10-12',end:'2026-10-17'},commission:40,paid:0,remaining:40},
    {date:'2026-10-19',week:{start:'2026-10-19',end:'2026-10-24'},commission:50,paid:0,remaining:50}
  ],
  open:[
    {date:'2026-10-15',week:{start:'2026-10-12',end:'2026-10-17'},commission:80,paid:20,remaining:60},
    {date:'2026-10-16',week:{start:'2026-10-12',end:'2026-10-17'},commission:40,paid:0,remaining:40},
    {date:'2026-10-19',week:{start:'2026-10-19',end:'2026-10-24'},commission:50,paid:0,remaining:50}
  ],
  payments:[
    {dueDate:'2026-09-30',amount:900,description:'Baixa antiga comissão Fabiano'},
    {dueDate:'2026-10-09',amount:100,description:'Baixa comissão Fabiano'},
    {dueDate:'2026-10-15',amount:20,description:'Baixa parcial comissão Fabiano'}
  ],
  outstandingTotal:150
};

test('resumo semanal não puxa geração, baixa ou linhas de outras semanas',()=>{
  const summary=summarizePartnerCommissionWeek(ledger,'2026-10-12');
  assert.equal(summary.generated,120);
  assert.equal(summary.paid,20);
  assert.equal(summary.outstanding,100);
  assert.equal(summary.rows.length,2);
  assert.ok(summary.rows.every(item=>item.week.start==='2026-10-12'));
  assert.equal(summary.otherOutstanding,0);
  assert.equal(summary.totalOutstanding,100);
});

test('baixa de outra semana não aparece nem reduz a comissão da semana vigente',()=>{
  const summary=summarizePartnerCommissionWeek(ledger,'2026-10-19');
  assert.equal(summary.generated,50);
  assert.equal(summary.paid,0);
  assert.equal(summary.outstanding,50);
  assert.equal(summary.rows.length,1);
});

test('saldos de semanas encerradas são agrupados para contas a pagar e a semana vigente fica limpa',()=>{
  const rows=expiredPartnerCommissionWeeks(ledger,'2026-10-19');
  assert.deepEqual(rows,[{weekStart:'2026-10-12',weekEnd:'2026-10-17',amount:100}]);
  assert.ok(rows.every(item=>item.weekStart<'2026-10-19'));
});

test('semana dos sócios vai de segunda a sábado e domingo já inicia o próximo fechamento',()=>{
  assert.deepEqual(partnerCommissionWeek('2026-10-12'),{start:'2026-10-12',end:'2026-10-17'});
  assert.deepEqual(partnerCommissionWeek('2026-10-17'),{start:'2026-10-12',end:'2026-10-17'});
  assert.deepEqual(partnerCommissionWeek('2026-10-18'),{start:'2026-10-19',end:'2026-10-24'});
});
