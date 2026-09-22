import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {planStockUpsert} from '../src/stock-save-plan.js';

test('entrada agrupa peças repetidas e soma o saldo em um único lote',()=>{
  const current=[{id:'item-1',codigo:'FT-01',descricao:'Filtro',aplicacao:'Motor',quantidade:3,valor_unitario:20}],metadata={'item-1':{brand:'Marca A',supplier:'Luizinho',cost:10,markup:100}};
  const plan=planStockUpsert([{code:'ft-01',description:'Filtro',quantity:2,cost:12,markup:50,value:18},{code:'FT-01',description:'Filtro',quantity:1,cost:12,markup:50,value:18}],current,metadata);
  assert.equal(plan.rows.length,1);
  assert.deepEqual(plan.rows[0],{id:'item-1',codigo:'FT-01',descricao:'Filtro',aplicacao:'Marca A',quantidade:6,valor_unitario:18,foto:null});
  assert.deepEqual(plan.metadata['item-1'],{brand:'Marca A',supplier:'Luizinho',cost:12,markup:50});
});

test('edição absoluta aceita zerar o saldo e rejeita valores inválidos',()=>{
  const current=[{id:'item-1',codigo:'FT-01',descricao:'Filtro',quantidade:3,valor_unitario:20}];
  const plan=planStockUpsert([{id:'item-1',code:'FT-01',description:'Filtro',quantity:0,cost:10,markup:100,value:20}],current,{}, {absolute:true});
  assert.equal(plan.rows[0].quantidade,0);
  assert.throws(()=>planStockUpsert([{description:'Filtro',quantity:-1}],current,{}),/quantidade válida/);
});

test('tela informa cache, falha do banco e oferece atualização manual',async()=>{
  const [stock,supabase,html,worker,style]=await Promise.all(['src/stock.js','src/supabase.js','index.html','public/sw.js','src/style.css'].map(file=>readFile(file,'utf8')));
  for(const label of ['Atualizar estoque','Atualizado às','Sem conexão com o banco','Saldo baixo','Sem saldo','Custo total'])assert.ok(stock.includes(label));
  assert.match(stock,/if\(loadId!==stockLoadId\)return/);
  assert.match(stock,/let stockSaved=false/);
  assert.doesNotMatch(stock,/stock=await readStock\(\);localStorage\.setItem/);
  assert.match(supabase,/estoque\?on_conflict=id/);
  assert.match(supabase,/body:plan\.rows/);
  assert.match(supabase,/saved\.warning=/);
  assert.match(html,/stock\.js\?v=20260922-1/);
  assert.match(html,/style\.css\?v=20260922-3/);
  assert.match(worker,/supabase\.js\?v=20260922-4/);
  assert.match(worker,/stock-save-plan\.js/);
  assert.match(worker,/cortez-garage-v221/);
  assert.match(style,/\.stock-summary/);
});
