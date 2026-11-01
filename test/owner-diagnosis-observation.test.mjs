import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('botão de diagnóstico fica visível, mas somente o proprietário abre o formulário',()=>{
  const module=read('src/owner-diagnosis-observation.js');
  const html=read('index.html');
  const worker=read('public/sw.js');
  assert.match(module,/const OWNER='cortezgaragemecanica@gmail\.com'/);
  assert.match(module,/id='ownerDiagnosisObservation'|button\.id='ownerDiagnosisObservation'/);
  assert.match(module,/Inserir diagnóstico e observações/);
  assert.match(module,/Salvar diagnóstico e observações/);
  assert.match(module,/getCurrentUser/);
  assert.match(module,/if\(!owner\(\)\)return alert\('Solicite pelo grupo do WhatsApp Diagnóstico e Observações\.'\)/);
  assert.match(module,/_persistTextFields/);
  assert.match(html,/owner-diagnosis-observation\.js\?v=20261017-1/);
  assert.match(worker,/cortez-garage-v317-commitment-window/);
  assert.match(worker,/owner-diagnosis-observation\.js\?v=20261017-1/);
});
