import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Enter avança os campos visíveis e inclui a peça no último campo',async()=>{
  const [budget,html,worker]=await Promise.all([
    readFile('src/budget-order.js','utf8'),
    readFile('index.html','utf8'),
    readFile('public/sw.js','utf8')
  ]);
  assert.match(budget,/const enterFields=\['#partCode','#partName','#partBrand','#partSupplier','#partCost','#partMargin','#partQuantity','#partSale'\]/);
  assert.match(budget,/addEventListener\('keydown',event=>\{if\(event\.key!=='Enter'\|\|event\.isComposing\)return;event\.preventDefault\(\)/);
  assert.match(budget,/filter\(input=>input&&!input\.disabled&&!input\.closest\('\[hidden\]'\)\)/);
  assert.match(budget,/if\(next\)\{next\.focus\(\);next\.select\?\.\(\);return\}/);
  assert.match(budget,/modal\.querySelector\('#includePart'\)\.click\(\)/);
  assert.match(html,/budget-order\.js\?v=20260922-1/);
  assert.match(worker,/budget-order\.js\?v=20260922-1/);
  assert.match(worker,/cortez-garage-v228/);
});

