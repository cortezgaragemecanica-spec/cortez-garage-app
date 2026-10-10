import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const source=await readFile(new URL('../src/admin.js',import.meta.url),'utf8');
const index=await readFile(new URL('../index.html',import.meta.url),'utf8');
const worker=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');

test('backup no computador usa download direto em vez do compartilhamento',()=>{
  assert.match(source,/function downloadBackupFile\(file,name\)/);
  assert.match(source,/link\.download=name/);
  assert.match(source,/mobileDevice&&typeof navigator\.share==='function'/);
  assert.match(source,/downloadBackupFile\(file,name\);return'download'/);
  assert.match(source,/pasta de downloads do computador/);
});

test('versão publicada inclui a correção do backup no PC',()=>{
  assert.match(index,/admin\.js\?v=20261010-2&amp;w=30/);
  assert.match(worker,/cortez-garage-v275-total-surcharge-parts-pdf/);
  assert.match(worker,/admin\.js\?v=20261010-2&w=30/);
});
