import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolveOrderStockLinks} from '../src/order-stock-links.js';

const stock=[
  {id:'stock-oleo',code:'OL-10',description:'Óleo 10W40',quantity:5},
  {id:'stock-filtro',code:'FT-01',description:'Filtro de óleo',quantity:2}
];

test('peça vinculada ao estoque não pede nova confirmação',()=>{
  const parts=[{description:'Óleo 10W40',code:'OL-10',quantity:2,stockMode:'stock',stockId:'stock-oleo'}];
  assert.deepEqual(resolveOrderStockLinks(parts,stock),{selections:[{partIndex:0,stockId:'stock-oleo'}],unresolved:[]});
});

test('vínculo antigo por código ou descrição exata é reaproveitado sem popup',()=>{
  const parts=[
    {description:'Descrição antiga',code:'FT-01',quantity:1,stockMode:'stock'},
    {description:'Óleo 10W40',quantity:1,stockMode:'stock'}
  ];
  assert.deepEqual(resolveOrderStockLinks(parts,stock),{selections:[{partIndex:0,stockId:'stock-filtro'},{partIndex:1,stockId:'stock-oleo'}],unresolved:[]});
});

test('compra direta é ignorada e vínculo físico inválido bloqueia a baixa',()=>{
  const parts=[
    {description:'Filtro de óleo',quantity:1,stockMode:'budget'},
    {description:'Filtro de óleo',quantity:3,stockMode:'stock',stockId:'stock-filtro'},
    {description:'Peça inexistente',quantity:1,stockMode:'stock'}
  ];
  assert.deepEqual(resolveOrderStockLinks(parts,stock),{selections:[],unresolved:[1,2]});
});

test('O.S. grava o ID do estoque e não abre popup ao ficar pronta',async()=>{
  const [budget,workflow]=await Promise.all([
    readFile(new URL('../src/budget-order.js',import.meta.url),'utf8'),
    readFile(new URL('../src/order-workflow.js',import.meta.url),'utf8')
  ]);
  assert.match(budget,/data-field="stockId"/);
  assert.match(budget,/stockId:stockMode==='purchase'\?'':selectedStock\.id/);
  assert.match(workflow,/resolveOrderStockLinks\(order\.budget\?\.parts\|\|\[\],stock\)/);
  assert.match(workflow,/finalizeOrderReady\(order,links\.selections\)/);
  assert.doesNotMatch(workflow.slice(workflow.indexOf('async function makeReady'),workflow.indexOf('async function reopenReady')),/stockPopup\(/);
});
