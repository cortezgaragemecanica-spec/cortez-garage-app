import test from 'node:test';
import assert from 'node:assert/strict';
import {machineSettlement,parseMachinePayment,RECEIPT_METHODS} from '../src/receipt-methods.js';

test('máquinas calculam débito e crédito e direcionam cada caixa',()=>{
 const expected=[
  ['Cartão máquina Cielo','Banco do Brasil',2.5,10],
  ['Cartão máquina Mercado Livre','Mercado Livre',2.5,10],
  ['Cartão máquina Rede Card (Luizinho)','Luizinho',1.5,5],
 ];
 for(const [method,account,debit,credit] of expected){
  for(const [type,rate] of [['Débito',debit],['Crédito',credit]]){
   const value=machineSettlement(1000,method,type);
   assert.equal(value.net,1000-rate*10);
   assert.equal(value.account,account);
   assert.deepEqual(parseMachinePayment(value.paymentType),{method,type});
  }
  assert.throws(()=>machineSettlement(1000,method,''));
 }
 assert.equal(RECEIPT_METHODS.length,6);
 assert.equal(machineSettlement(100,'Dinheiro',''),null);
});
