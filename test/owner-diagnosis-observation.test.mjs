import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('todo usuário recebe botão próprio para salvar diagnóstico e observações',()=>{
  const module=read('src/owner-diagnosis-observation.js');
  const html=read('index.html');
  const worker=read('public/sw.js');
  assert.doesNotMatch(module,/OWNER_EMAIL|owner\(\)/);
  assert.match(module,/id='ownerDiagnosisObservation'|button\.id='ownerDiagnosisObservation'/);
  assert.match(module,/Inserir diagnóstico e observações/);
  assert.match(module,/Salvar diagnóstico e observações/);
  assert.match(module,/_persistTextFields/);
  assert.match(html,/owner-diagnosis-observation\.js\?v=20261015-1/);
  assert.match(worker,/cortez-garage-v282-order-save-reliability/);
  assert.match(worker,/owner-diagnosis-observation\.js\?v=20261015-1/);
});
