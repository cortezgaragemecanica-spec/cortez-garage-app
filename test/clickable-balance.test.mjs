import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [admin,style,index,worker]=await Promise.all([
  'src/admin.js','src/style.css','index.html','public/sw.js'
].map(path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')));

test('cartão do balanço é acessível por clique e teclado',()=>{
  assert.match(admin,/finance-balance-sheet" role="button" tabindex="0"/);
  assert.match(admin,/aria-label="Ver composição do balanço"/);
  assert.match(admin,/function wireFinancialBalance\(\)/);
  assert.match(admin,/event\.key==='Enter'\|\|event\.key===' '/);
  assert.match(admin,/wireCompanyHealth\(\);wireFinancialBalance\(\)/);
});

test('detalhamento apresenta todos os componentes da fórmula',()=>{
  assert.match(admin,/function openBalanceDetails\(\)/);
  for(const label of ['Banco do Brasil','Mercado Livre','Dinheiro','Contas a receber · O.S. prontas','Contas a pagar vencidas ou desta semana','Comissões da equipe','Comissões dos sócios','Balanço atual'])assert.ok(admin.includes(label));
  assert.match(admin,/money\(total\.balanceSheet\)/);
  assert.match(admin,/items\.map/);
});

test('cartão e sinais positivos e negativos possuem destaque visual',()=>{
  assert.match(style,/\.finance-balance-sheet\{cursor:pointer/);
  assert.match(style,/\.finance-balance-sheet:hover,.finance-balance-sheet:focus/);
  assert.match(style,/\.balance-operation\.positive\{color:#69d37c/);
  assert.match(style,/\.balance-operation\.negative\{color:#ff7777/);
});

test('publicação invalida os caches do módulo e do estilo',()=>{
  assert.match(index,/admin\.js\?v=20260922-4/);
  assert.match(index,/style\.css\?v=20260922-2/);
  assert.match(worker,/cortez-garage-v220/);
  assert.match(worker,/admin\.js\?v=20260922-4/);
  assert.match(worker,/style\.css\?v=20260922-2/);
});
