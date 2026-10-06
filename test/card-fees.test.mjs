import test from'node:test';
import assert from'node:assert/strict';
import{CARD_FEE_RATES,calculateCardSettlement}from'../src/card-fees.js';

test('aplica as taxas configuradas de 1x a 10x',()=>{
  assert.deepEqual(CARD_FEE_RATES,{1:2.7,2:3.5,3:3.9,4:4.2,5:5.5,6:5.5,7:7.6,8:8.2,9:8.7,10:10.2});
  assert.deepEqual(calculateCardSettlement(1000,1),{installments:1,rate:2.7,gross:1000,fee:27,net:973,installmentAmounts:[1000]});
  assert.deepEqual(calculateCardSettlement(1000,10),{installments:10,rate:10.2,gross:1000,fee:102,net:898,installmentAmounts:Array(10).fill(100)});
});

test('arredonda em centavos sem alterar o total cobrado do cliente',()=>{
  const result=calculateCardSettlement(100,3);
  assert.equal(result.fee,3.9);
  assert.equal(result.net,96.1);
  assert.equal(result.installmentAmounts.reduce((sum,value)=>sum+value,0),100);
  assert.deepEqual(result.installmentAmounts,[33.34,33.33,33.33]);
});

test('rejeita parcelamento fora da faixa permitida',()=>{
  assert.throws(()=>calculateCardSettlement(100,0),/a vista ou de 2x a 10x/);
  assert.throws(()=>calculateCardSettlement(100,11),/a vista ou de 2x a 10x/);
});
