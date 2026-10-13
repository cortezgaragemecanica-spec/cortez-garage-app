import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('proprietário visualiza e abre a descrição completa do serviço nas comissões dos mecânicos',async()=>{
  const[admin,style]=await Promise.all([read('src/admin.js'),read('src/style.css')]);
  assert.match(admin,/function commissionServiceDescription\(record\)/);
  assert.match(admin,/-servico-\(\\d\+\)/);
  assert.match(admin,/class="commission-description-link"/);
  assert.match(admin,/financeOwner\(\)&&record\?\.id/);
  assert.match(admin,/Descrição completa do serviço/);
  assert.match(admin,/wireCommissionDescriptions\(target\)/);
  assert.match(style,/\.commission-description-link/);
  assert.match(style,/\.commission-full-description/);
});
