import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/supabase.js',import.meta.url),'utf8');
const migration=await readFile(new URL('../supabase/corrigir-rpc-kaua-luizinho.sql',import.meta.url),'utf8');

test('Acerto Luizinho tenta gravação direta quando a RPC não está no cache',()=>{
  assert.match(source,/PGRST202\|schema cache/);
  assert.match(source,/if\(!missingLuizinhoRpc\(error\)\)throw error/);
  assert.match(source,/try\{await writeSupplierConfig\(session,current,body\)\}/);
});

test('migração recria a RPC, concede acesso e recarrega o cache sem apagar dados',()=>{
  assert.match(migration,/create or replace function public\.kaua_salvar_acerto_luizinho/);
  assert.match(migration,/grant execute on function public\.kaua_salvar_acerto_luizinho/);
  assert.match(migration,/create policy sincronizacao_kaua_luizinho_update/);
  assert.match(migration,/create policy sincronizacao_kaua_luizinho_config_insert/);
  assert.match(migration,/notify pgrst, 'reload schema'/);
  assert.doesNotMatch(migration,/\b(?:delete\s+from|truncate|drop\s+table)\b/i);
});
