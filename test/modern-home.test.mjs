import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('página inicial moderna prioriza ação, atalhos e fluxo da oficina',async()=>{
  const main=await read('src/main.js');
  for(const label of ['Para onde você quer ir?','O que precisa de atenção','Registrar nova entrada','Ver ordens de serviço','Ordens modificadas recentemente'])assert.ok(main.includes(label));
  assert.match(main,/class="hero dashboard-hero"/);
  assert.match(main,/class="home-menu dashboard-home"/);
  assert.match(main,/focusGroups=visibleOrderGroups\(\)\.filter/);
  assert.match(main,/hasPermission\('createEntries'\)\?/);
});

test('página inicial adapta cartões e ações para computador e celular',async()=>{
  const style=await read('src/style.css');
  assert.match(style,/\.dashboard-hero\{[^}]*grid-template-columns:/);
  assert.match(style,/\.dashboard-home\{grid-template-columns:repeat\(5/);
  assert.match(style,/@media\(max-width:750px\)[\s\S]*?\.dashboard-home\{grid-template-columns:1fr 1fr/);
  assert.match(style,/@media\(max-width:480px\)[\s\S]*?\.dashboard-hero-actions\{grid-template-columns:1fr/);
});
