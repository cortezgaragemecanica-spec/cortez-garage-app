import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

test('Cortez fica inativo como mecânico e sai do quadro de comissões',async()=>{
  const [supabase,admin,sql]=await Promise.all(['../src/supabase.js','../src/admin.js','../supabase/desativar-cortez-mecanico.sql'].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
  assert.match(supabase,/DEFAULT_INACTIVE_MECHANICS=new Set\(\['cortez'\]\)/);
  assert.match(supabase,/active:typeof entry==='string'\?!DEFAULT_INACTIVE_MECHANICS/);
  assert.match(admin,/activeMechanics\(\)\.map\(name=>`<button data-mechanic/);
  assert.match(sql,/lower\(coalesce\(item ->> 'name', item #>> '\{\}'\)\) = 'cortez'/);
  assert.match(sql,/jsonb_build_object\('active', false\)/);
});
