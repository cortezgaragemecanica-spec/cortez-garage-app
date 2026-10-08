import test from'node:test';
import assert from'node:assert/strict';
import{paginate,pagerHtml}from'../src/pagination.js';
import{readFile}from'node:fs/promises';

test('paginação limita os registros e corrige páginas fora do intervalo',()=>{
  const rows=Array.from({length:82},(_,index)=>index+1),middle=paginate(rows,2,30),last=paginate(rows,99,30);
  assert.deepEqual(middle.items,[...rows].slice(30,60));
  assert.equal(middle.from,31);assert.equal(middle.to,60);assert.equal(middle.pages,3);
  assert.equal(last.page,3);assert.equal(last.items.length,22);
  assert.match(pagerHtml(last,'clientes'),/61–82 de 82 clientes/);
});

test('Fase 1 pagina listas grandes e mantém todas as áreas no menu mobile',async()=>{
  const [main,stock,style,reports,admin]=await Promise.all(['main.js','stock.js','style.css','reports.js','admin.js'].map(file=>readFile(new URL(`../src/${file}`,import.meta.url),'utf8')));
  assert.match(main,/paginate\(matching,orderPage,25\)/);
  assert.match(main,/paginate\(filtered,peoplePage,30\)/);
  assert.match(stock,/paginate\(matching,stockPageNumber,40\)/);
  assert.match(stock,/data-stock-filter/);
  assert.match(reports,/enableProgressiveTables/);
  assert.match(admin,/enableProgressiveTables/);
  assert.match(style,/\.mobile-nav \.stock-route[^}]*display:flex!important/);
});
