import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('botão de diagnóstico libera proprietário, Fábio, Tony e Gustavo',()=>{
  const module=read('src/owner-diagnosis-observation.js');
  const html=read('index.html');
  const worker=read('public/sw.js');
  assert.match(module,/canUseOrderRequestForms/);
  assert.match(module,/id='ownerDiagnosisObservation'|button\.id='ownerDiagnosisObservation'/);
  assert.match(module,/Inserir diagnóstico e observações/);
  assert.match(module,/Salvar diagnóstico e observações/);
  assert.match(module,/getCurrentUser/);
  assert.match(module,/if\(!requestAccess\(\)\)return alert\('Solicite pelo grupo do WhatsApp Diagnóstico e Observações\.'\)/);
  assert.match(module,/_persistTextFields/);
  assert.match(html,/owner-diagnosis-observation\.js\?v=20261031-1/);
  assert.match(worker,/cortez-garage-v325-mobile-responsive/);
  assert.match(worker,/owner-diagnosis-observation\.js\?v=20261031-1/);
});
