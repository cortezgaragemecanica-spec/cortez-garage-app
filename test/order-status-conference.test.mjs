import test from 'node:test';
import assert from 'node:assert/strict';
import {approvalAction,approveStatusConference} from '../src/order-status-conference.js';
const at='2026-11-26T15:00:00Z';
const request=(destino='Pronto para entrega')=>({id:'request',os_id:'os',setor:'mecanica',destino,versao:at,pagamento:{payment:'Pix BB',cashPayment:'Pix BB'}});
function scenario(status){const state={id:'os',status,updatedAt:at,total:130,budget:{parts:[{description:'Peça',value:30}],services:[{description:'Serviço',value:100}]}},calls=[];return{state,calls,operations:{readOrder:async()=>({...state}),makeReady:async()=>{calls.push('ready');state.status='Pronto para entrega'},recordDelivery:async()=>calls.push('cash'),saveOrder:async()=>calls.push('save'),updateStatus:async(_id,status)=>{calls.push('status');state.status=status},resolveRequest:async()=>calls.push('resolve')}}}

test('conferir O.S. pronta não repete baixa, recebíveis ou gravação dos valores',async()=>{
 const {state,calls,operations}=scenario('Pronto para entrega'),before=JSON.stringify(state);
 const result=await approveStatusConference(request(),state,operations);
 assert.equal(result.changed,false);assert.deepEqual(calls,['resolve']);assert.equal(JSON.stringify(state),before);
});
test('solicitação antiga de pronta não regride O.S. já entregue',async()=>{
 const {state,calls,operations}=scenario('Entregue');
 await approveStatusConference(request(),state,operations);
 assert.deepEqual(calls,['resolve']);assert.equal(state.status,'Entregue');
});
test('conferir entrega já feita não repete caixa nem comissões',async()=>{
 const {state,calls,operations}=scenario('Entregue');
 await approveStatusConference(request('Entregue'),state,operations);
 assert.deepEqual(calls,['resolve']);
});
test('etapa pronta pendente é aplicada uma vez mesmo com nova tentativa',async()=>{
 const {state,calls,operations}=scenario('Em andamento'),snapshot={...state};
 await approveStatusConference(request(),snapshot,operations);
 await approveStatusConference(request(),snapshot,operations);
 assert.deepEqual(calls,['ready','resolve','resolve']);assert.equal(state.total,130);
});
test('entrega pendente aplica fechamento uma vez e confirmação posterior só registra conferência',async()=>{
 const {state,calls,operations}=scenario('Pronto para entrega'),snapshot={...state};
 await approveStatusConference(request('Entregue'),snapshot,operations);
 await approveStatusConference(request('Entregue'),snapshot,operations);
 assert.deepEqual(calls,['cash','save','status','resolve','resolve']);assert.equal(state.status,'Entregue');
});
test('considera dados que proprietário acabou de revisar e bloqueia mudança posterior',()=>{
 const current={status:'Em andamento',updatedAt:at},oldRequest={...request(),versao:'2026-11-25T12:00:00Z'};
 assert.equal(approvalAction(current,oldRequest,current),'ready');
 assert.throws(()=>approvalAction({...current,updatedAt:'2026-11-26T16:00:00Z'},oldRequest,current),/mudou durante a conferência/);
 assert.throws(()=>approvalAction({...current,status:'Recusado'},request(),current),/recusada/);
 assert.throws(()=>approvalAction({status:'Pronto para entrega',updatedAt:at},{...request('Entregue'),pagamento:null},{updatedAt:at}),/pagamento/);
});
test('clique concorrente não duplica a aprovação',async()=>{
 const {state,calls,operations}=scenario('Em andamento');let unlock;operations.makeReady=()=>new Promise(resolve=>{unlock=()=>{calls.push('ready');state.status='Pronto para entrega';resolve()}});
 const first=approveStatusConference(request(),state,operations);await Promise.resolve();
 await assert.rejects(approveStatusConference(request(),state,operations),/já está sendo conferida/);
 unlock();await first;assert.deepEqual(calls,['ready','resolve']);
});
test('falha não marca solicitação como aprovada e permite tentar novamente',async()=>{
 const {state,calls,operations}=scenario('Em andamento'),ready=operations.makeReady;operations.makeReady=async()=>{throw new Error('Falha no banco')};
 await assert.rejects(approveStatusConference(request(),state,operations),/Falha no banco/);assert.deepEqual(calls,[]);
 operations.makeReady=ready;await approveStatusConference(request(),state,operations);assert.deepEqual(calls,['ready','resolve']);
});
