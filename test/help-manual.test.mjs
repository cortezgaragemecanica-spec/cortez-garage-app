import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const read=file=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('botão de ajuda abre um manual completo e pesquisável',async()=>{
  const[help,index,style,worker]=await Promise.all([read('src/help.js'),read('index.html'),read('src/style.css'),read('public/sw.js')]);
  assert.match(index,/help\.js\?v=20261008-2/);
  assert.match(worker,/help\.js\?v=20261008-2/);
  assert.match(help,/id='openHelp'|button\.id='openHelp'/);
  assert.match(help,/Pesquisar no manual/);
  assert.match(help,/Imprimir \/ salvar PDF/);
  assert.match(help,/Primeiros passos/);
  assert.match(help,/Fluxo da ordem de serviço/);
  assert.match(help,/Pronto para entrega/);
  assert.match(help,/Comissões/);
  assert.match(help,/Acerto Luizinho e devoluções/);
  assert.match(help,/Backup e restauração/);
  assert.match(help,/Solução de problemas/);
  assert.match(style,/\.help-center/);
  assert.match(style,/@media print\{body\.help-open/);
});

test('manual funciona no computador e no celular',async()=>{
  const[help,style]=await Promise.all([read('src/help.js'),read('src/style.css')]);
  assert.match(help,/onUiUpdated\(installHelpButton\)/);
  assert.match(help,/aria-label','Abrir manual e ajuda/);
  assert.match(help,/event\.key==='Escape'/);
  assert.match(style,/@media\(max-width:760px\).*\.help-center\{padding:0\}/s);
  assert.match(style,/\.help-button span\{display:none\}/);
});

