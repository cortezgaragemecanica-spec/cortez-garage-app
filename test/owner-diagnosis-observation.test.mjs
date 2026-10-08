import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('proprietário recebe botão próprio para salvar diagnóstico e observações',()=>{
  const module=read('src/owner-diagnosis-observation.js');
  const html=read('index.html');
  const worker=read('public/sw.js');
  assert.match(module,/OWNER_EMAIL='cortezgaragemecanica@gmail\.com'/);
  assert.match(module,/id='ownerDiagnosisObservation'|button\.id='ownerDiagnosisObservation'/);
  assert.match(module,/Inserir diagnóstico e observações/);
  assert.match(module,/Salvar diagnóstico e observações/);
  assert.match(module,/document\.querySelector\('#saveOs'\)\?\.click\(\)/);
  assert.match(html,/owner-diagnosis-observation\.js\?v=20260929-1/);
  assert.match(worker,/cortez-garage-v263-budget-parts/);
  assert.match(worker,/owner-diagnosis-observation\.js\?v=20260929-1/);
});
