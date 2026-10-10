import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const read=file=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('notas do Luizinho podem ser criadas e alteradas em qualquer dia da semana',async()=>{
  const source=await read('src/supabase.js');
  assert.doesNotMatch(source,/As notas do Luizinho devem ser lançadas de segunda a sexta/);
  assert.doesNotMatch(source,/type==='luizinho'&&\(day<1\|\|day>5\)/);
  assert.match(source,/function validateLuizinhoNote\(record\)\{const date=supplierDate\(record\?\.date\),items=normalizeLuizinhoItems/);
});

test('notas de sábado e domingo entram no acerto e no total da semana',async()=>{
  const[supabase,admin]=await Promise.all([read('src/supabase.js'),read('src/admin.js')]);
  assert.doesNotMatch(supabase,/for\(const item of rows\)\{const day=.*?continue;/);
  assert.match(supabase,/for\(const item of rows\)\{const week=supplierWeek\(item\.date\)/);
  assert.match(admin,/filter\(item=>workWeek\(item\.date\)\.start===week\.start\)/);
});
