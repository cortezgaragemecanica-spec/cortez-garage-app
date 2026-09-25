import test from'node:test';
import assert from'node:assert/strict';
import{appliedMechanicAdvanceRows,commissionWeekRange,mechanicAdvanceName,mechanicAdvanceRows}from'../src/mechanic-advances.js';

test('identifica vale pelo nome de qualquer mecânico',()=>{
  const names=['Gustavo Ribas','Fábio','Tony'];
  assert.equal(mechanicAdvanceName('Vale Gustavo - adiantamento',names),'Gustavo Ribas');
  assert.equal(mechanicAdvanceName('VALE FÁBIO',names),'Fábio');
  assert.equal(mechanicAdvanceName('Pagamento Gustavo',names),'');
});

test('considera somente saídas realizadas na semana de sábado a sexta',()=>{
  assert.deepEqual(commissionWeekRange('2026-09-18'),{start:'2026-09-12',end:'2026-09-18'});
  const rows=mechanicAdvanceRows([
    {id:'1',category:'Fluxo de caixa',kind:'Saída',status:'Realizado',description:'Vale Gustavo',amount:100,dueDate:'2026-09-18'},
    {id:'2',category:'Fluxo de caixa',kind:'Entrada',status:'Realizado',description:'Vale Gustavo',amount:50,dueDate:'2026-09-18'},
    {id:'3',category:'Fluxo de caixa',kind:'Saída',status:'Realizado',description:'Vale Fabio',amount:80,dueDate:'2026-09-11'}
  ],['Gustavo','Fabio'],'2026-09-12');
  assert.equal(rows.length,1);
  assert.equal(rows[0].advanceMechanic,'Gustavo');
});

test('oculta o vale quando nenhuma comissão aberta usa o desconto',()=>{
  const advances=[{id:'vale-1',amount:150,description:'vale gustavo'}];
  assert.deepEqual(appliedMechanicAdvanceRows(advances,0),[]);
  assert.deepEqual(appliedMechanicAdvanceRows(advances,100).map(item=>item.amount),[100]);
});
