import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {suggestedItemSector} from '../src/sector-suggestions.js';

test('incluir peça nova aceita item de edição nulo e preserva a sugestão elétrica',async()=>{
 const source=readFileSync(new URL('../src/budget-order.js',import.meta.url),'utf8');
 const marker="modal.querySelector('#includePart').onclick=";
 const handler=source.slice(source.indexOf(marker)+marker.length).split('\n')[0].trim().replace(/;$/,'');
 const fields={partCode:'',partName:'Lâmpada H7',partBrand:'',partSupplier:'Fornecedor'},button={disabled:false,textContent:''},saved=[],alerts=[];
 const modal={querySelector:selector=>selector==='#includePart'?button:{value:fields[selector.slice(1)]}};
 let closed=false;
 const factory=new Function('modal','lookupTimer','stockMode','calculate','item','onSave','currentOrder','suggestedItemSector','close','alert','editing','return '+handler);
 const include=factory(modal,0,'purchase',()=>({quantity:1,cost:128,value:217.6}),null,item=>saved.push(item),()=>({order:{sourceSector:'mecanica'}}),suggestedItemSector,()=>closed=true,message=>alerts.push(message),false);
 await include();
 assert.deepEqual(alerts,[]);
 assert.equal(saved.length,1);
 assert.equal(saved[0].description,'Lâmpada H7');
 assert.equal(saved[0].sector,'auto_eletrica');
 assert.equal(saved[0].sectorManual,false);
 assert.equal(saved[0].value,217.6);
 assert.equal(closed,true);
});
