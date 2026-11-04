import test from 'node:test';
import assert from 'node:assert/strict';
import {serviceMechanicOptions} from '../src/mechanic-privacy.js';
test('serviços mantêm a ordem solicitada mesmo com mecânico já selecionado',()=>{
 assert.deepEqual(serviceMechanicOptions(['Gustavo','Cortez','Fabio','Tony'],'Gustavo','cortezgaragemecanica@gmail.com'),['Tony','Fabio','Gustavo','Cortez']);
 assert.deepEqual(serviceMechanicOptions(['Gustavo','Cortez','Fábio','Tony'],'Gustavo','outro@example.com'),['Tony','Fábio','Gustavo']);
});
