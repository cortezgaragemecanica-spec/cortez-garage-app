import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../src/supabase.js',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('const PAYABLE_CATEGORIES='),source.indexOf('export async function readFinance('));
const wrappers=source.slice(source.lastIndexOf('export async function saveFinanceRecord(')).replaceAll('export async','async');
function setup(){
 const calls=[];
 const ctx=vm.createContext({crypto:{randomUUID:()=> 'new-id'},OWNER_EMAIL:'owner',currentEmail:()=> 'owner',refreshSession:async()=>({access_token:'test'}),request:async(url,options)=>{calls.push({url,...options});return []},saveFinanceRecordBase:async r=>{calls.push({insert:r});return r},updateFinanceRecordBase:async(id,r)=>{calls.push({update:r});return {id,...r}}});
 vm.runInContext(helpers+wrappers,ctx);
 return {ctx,calls};
}
test('grava cada categoria e mantém vínculo com a conta',async()=>{
 for(const category of ['Boleto','Conta mensal','Acerto']){
  const {ctx,calls}=setup();ctx.category=category;
  const result=await vm.runInContext("saveFinanceRecord({category:'Conta a pagar',payableCategory:category})",ctx);
  assert.equal(calls[0].body.dados.category,category);
  assert.equal(calls[0].body.registro_id,'conta-categoria-new-id');
  assert.equal(calls[1].insert.id,'new-id');
  assert.equal(result.payableCategory,category);
 }
});
test('edita ou remove categoria sem alterar referência do pagamento',async()=>{
 const {ctx,calls}=setup();
 await vm.runInContext("updateFinanceRecord('id',{category:'Conta a pagar',payableCategory:'',reference:'luizinho-semana'})",ctx);
 assert.equal(calls[0].update.reference,'luizinho-semana');
 assert.equal(calls[1].body.id,'id');
 assert.equal(calls[1].body.dados.category,'');
});
test('outros lançamentos não gravam categorias e opção inválida é rejeitada',async()=>{
 const {ctx,calls}=setup();
 await vm.runInContext("saveFinanceRecord({category:'Fluxo de caixa'})",ctx);
 assert.equal(calls.length,1);
 await assert.rejects(vm.runInContext("saveFinanceRecord({category:'Conta a pagar',payableCategory:'Inválida'})",ctx),/inválida/);
 assert.equal(calls.length,1);
});
