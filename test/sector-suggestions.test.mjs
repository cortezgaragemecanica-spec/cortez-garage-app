import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestedItemSector} from '../src/sector-suggestions.js';

test('tags pré-selecionam peças e serviços elétricos e respeitam ajustes manuais e estoque',()=>{
 assert.equal(suggestedItemSector({description:'Lâmpada H7',sector:'mecanica'}),'auto_eletrica');
 assert.equal(suggestedItemSector({description:'Reparo do alternador'}),'auto_eletrica');
 assert.equal(suggestedItemSector({description:'Terminal da direção elétrica',sector:'auto_eletrica'}),'mecanica');
 assert.equal(suggestedItemSector({description:'Lâmpada H4',sector:'mecanica',sectorManual:true}),'mecanica');
 assert.equal(suggestedItemSector({description:'Lâmpada H4',sector:'mecanica',stockId:'physical-stock'}),'mecanica');
 const order={budget:{parts:[{description:'Buzina',value:50}]}};
 assert.equal(suggestedItemSector({description:'Mão de obra'},order),'auto_eletrica');
 order.budget.parts.push({description:'Pastilha',value:50});
 assert.equal(suggestedItemSector({description:'Mão de obra'},order),'mecanica');
});
