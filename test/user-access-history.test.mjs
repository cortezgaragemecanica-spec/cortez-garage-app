import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

test('aplicativo registra sessões e tempo ativo dos usuários',async()=>{
  const [supabase,main,sql]=await Promise.all(['../src/supabase.js','../src/main.js','../supabase/historico-acessos.sql'].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
  assert.match(supabase,/export async function startUsageTracking/);
  assert.match(supabase,/USAGE_HEARTBEAT_MS=30000/);
  assert.match(supabase,/active_seconds/);
  assert.match(supabase,/visibilitychange/);
  assert.match(supabase,/pagehide/);
  assert.match(main,/startUsageTracking\(\)\.catch/);
  assert.match(sql,/create table if not exists public\.app_user_sessions/);
  assert.match(sql,/app_user_sessions_own_insert/);
  assert.match(sql,/app_user_sessions_own_update/);
  assert.match(sql,/app_user_sessions_owner_read/);
});

test('gerenciamento mostra acessos somente ao lado dos usuários que não são proprietários',async()=>{
  const [admin,style]=await Promise.all(['../src/admin.js','../src/style.css'].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
  assert.match(admin,/user\.email!==FINANCE_EMAIL\?'<button class="secondary view-user-access">Ver acessos<\/button>'/);
  assert.match(admin,/readUserUsage\(user\.email\)/);
  for(const label of['Quantidade de acessos','Tempo ativo acumulado','Último acesso','Última atividade','Ativo agora'])assert.ok(admin.includes(label));
  assert.match(style,/\.user-access-popup \.check-popup-card/);
  assert.match(style,/\.user-access-table/);
});
