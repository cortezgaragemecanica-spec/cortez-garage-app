import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import{planMechanicCommissionSettlements}from'../src/commission-settlement.js';

const commission=(id,value,status='Pendente',date='2026-09-25')=>({id,categoria:'Comissões',movimento:'Saída',descricao:`Comissão ${id}`,valor:value,vencimento:date,status,mecanico:'Gustavo',semana_inicio:'2026-09-19'});
const cash=(description,value,date='2026-09-25')=>({id:description,categoria:'Fluxo de caixa',movimento:'Saída',descricao:description,valor:value,vencimento:date,status:'Realizado'});

test('pagamento líquido mais vale baixa todas as comissões da semana',()=>{
  const rows=[commission('os-1',220),commission('os-2',60),commission('os-3',780),commission('os-4',230),commission('os-5',175),cash('pago comissões Gustavo',1315),cash('vale gustavo',150)];
  const plan=planMechanicCommissionSettlements(rows,['Gustavo','Fabio']);
  assert.deepEqual(plan.fullIds,['os-1','os-2','os-3','os-4','os-5']);
  assert.deepEqual(plan.partial,[]);
});

test('pagamento parcial separa o valor pago e mantém somente o saldo aberto',()=>{
  const plan=planMechanicCommissionSettlements([commission('os-1',300),cash('comissão Gustavo',120)],['Gustavo']);
  assert.deepEqual(plan.fullIds,[]);
  assert.equal(plan.partial[0].paid,120);
  assert.equal(plan.partial[0].remaining,180);
});

test('comissões já arquivadas consomem pagamentos anteriores da mesma semana',()=>{
  const plan=planMechanicCommissionSettlements([commission('paga',100,'Realizado'),commission('nova',80),cash('comissões Gustavo',100)],['Gustavo']);
  assert.deepEqual(plan.fullIds,[]);
  assert.deepEqual(plan.partial,[]);
});

test('financeiro reconcilia a baixa automática ao carregar os lançamentos',()=>{
  const source=fs.readFileSync(new URL('../src/supabase.js',import.meta.url),'utf8');
  assert.match(source,/reconcileMechanicCommissionSettlements/);
  assert.match(source,/planMechanicCommissionSettlements/);
  assert.match(source,/if\(await reconcileMechanicCommissionSettlements\(session,rows\)\)rows=await readPages/);
});
