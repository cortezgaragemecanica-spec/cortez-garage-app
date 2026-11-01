import test from 'node:test';
import assert from 'node:assert/strict';
import {canUseOrderRequestForms} from '../src/order-request-access.js';

test('proprietário, Fábio, Tony e Gustavo podem abrir solicitações da O.S.',()=>{
  assert.equal(canUseOrderRequestForms({email:'cortezgaragemecanica@gmail.com'}),true);
  assert.equal(canUseOrderRequestForms({name:'Fábio'}),true);
  assert.equal(canUseOrderRequestForms({name:'Tony da Silva'}),true);
  assert.equal(canUseOrderRequestForms({email:'tony@cortezgarage.com'}),true);
  assert.equal(canUseOrderRequestForms({email:'gust.cribas@gmail.com'},{name:'Gustavo'}),true);
  assert.equal(canUseOrderRequestForms({email:'mecanico@exemplo.com'},{agendaMechanic:'Fabio'}),true);
});

test('outros usuários continuam orientados a solicitar pelo grupo',()=>{
  assert.equal(canUseOrderRequestForms({name:'Kauã'}),false);
  assert.equal(canUseOrderRequestForms({name:'Marcelino'}),false);
  assert.equal(canUseOrderRequestForms({name:'Fabiano'}),false);
  assert.equal(canUseOrderRequestForms({email:'tony-falso@exemplo.com'}),false);
});
