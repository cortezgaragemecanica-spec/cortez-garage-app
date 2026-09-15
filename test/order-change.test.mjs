import test from 'node:test';
import assert from 'node:assert/strict';
import{orderContentFingerprint}from'../src/order-change.js';

const order=()=>({
  numero:49,cliente_id:'cliente-1',veiculo_id:'veiculo-1',reclamacao:'Barulho',diagnostico:'',status:'Em andamento',mao_obra:100,valor_pecas:0,desconto:0,total:100,checklist:[],data_entrada:'2026-09-01T12:00:00Z',
  dados_extras:{services:'',parts:'',signature:'',budget:{parts:[],services:[{description:'Teste',value:100}]},client:{id:'cliente-1',name:'Cliente',updatedAt:'2026-09-01'},vehicle:{id:'veiculo-1',plate:'ABC1D23',updatedAt:'2026-09-01'},updatedBy:{email:'mecanico@exemplo.com',at:'2026-09-01'}}
});

test('salvar novamente ou mudar auditoria não conta como modificação da O.S.',()=>{
  const original=order(),saved=order();
  saved.atualizado_em='2026-09-15T18:00:00Z';
  saved.dados_extras.updatedBy={email:'proprietario@exemplo.com',at:'2026-09-15'};
  saved.dados_extras.client.updatedAt='2026-09-15';
  saved.dados_extras.vehicle.updatedAt='2026-09-15';
  assert.equal(orderContentFingerprint(saved),orderContentFingerprint(original));
});

test('diagnóstico, status e itens alterados contam como modificação da O.S.',()=>{
  const original=order(),fingerprint=orderContentFingerprint(original);
  for(const change of [row=>row.diagnostico='Defeito no alternador',row=>row.status='Aguardando peça',row=>row.dados_extras.budget.services[0].value=150]){
    const changed=order();change(changed);
    assert.notEqual(orderContentFingerprint(changed),fingerprint);
  }
});
