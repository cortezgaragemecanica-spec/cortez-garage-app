import test from 'node:test';
import assert from 'node:assert/strict';
import {isExecutionPdf,servicePdfSection,budgetObservation} from '../src/pdf-order-sections.js';
import {drawReport} from '../src/pdf-order.js';

const formatMoney=value=>`R$ ${Number(value||0).toFixed(2)}`;
const order={status:'Aguardando aprovação',mechanic:'Gustavo',services:'Troca de óleo',budget:{services:[{description:'Troca de óleo',mechanic:'Fabio',value:150}]}};

test('orçamento e aguardando aprovação mostram apenas serviços orçados sem mecânico',()=>{
  for(const status of ['Orçamento','Orçamento fora do pátio','Aguardando aprovação']){
    const section=servicePdfSection({...order,status},formatMoney);
    assert.equal(isExecutionPdf({...order,status}),false);
    assert.equal(section.title,'Serviços orçados');
    assert.deepEqual(section.headers,['Serviço','Valor']);
    assert.deepEqual(section.rows,[['Troca de óleo','R$ 150.00']]);
  }
  assert.equal(budgetObservation(order),'');
});

test('serviço aprovado ou executado mostra peças e serviços executados com mecânico',()=>{
  for(const status of ['Em andamento','Aguardando peça','Aguardando peças','Pronto para entrega','Entregue']){
    const section=servicePdfSection({...order,status},formatMoney);
    assert.equal(isExecutionPdf({...order,status}),true);
    assert.equal(section.title,'Serviços executados');
    assert.deepEqual(section.headers,['Serviço','Mecânico','Valor']);
    assert.deepEqual(section.rows,[['Troca de óleo','Fabio','R$ 150.00']]);
  }
});

test('observação independente não é apagada no orçamento',()=>{
  assert.equal(budgetObservation({...order,services:'Cliente pede contato antes da troca'}),'Cliente pede contato antes da troca');
});

test('orçamento inclui diagnóstico e observações preenchidos',()=>{
  const originalDocument=globalThis.document;
  globalThis.document={createElement:()=>{
    const canvas={texts:[]};
    canvas.getContext=()=>( {
      font:'',fillStyle:'',strokeStyle:'',lineWidth:0,
      drawImage(){},fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},
      fillText(value){canvas.texts.push(String(value))},
      measureText(value){return{width:String(value).length*9}}
    });
    return canvas;
  }};
  try{
    for(const status of ['Aguardando diagnóstico','Aguardando aprovação']){
      const report={...order,status,number:'0069',created:'2026-09-29T10:00:00',complaint:'Ruído no motor',diagnosis:'Tensor da correia com folga',services:'Cliente pede contato antes da troca',notes:'Veículo deve permanecer na oficina',client:{name:'Cliente teste'},vehicle:{model:'Carro teste'},checklist:[],budget:{services:[],parts:[]}};
      const texts=drawReport(report,{}).flatMap(page=>page.texts);
      assert.ok(texts.includes('Diagnóstico técnico:'));
      assert.ok(texts.includes(report.diagnosis));
      assert.ok(texts.includes('Observação:'));
      assert.ok(texts.includes(report.services));
      assert.ok(texts.includes('Observações adicionais:'));
      assert.ok(texts.includes(report.notes));
    }
  }finally{
    if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
  }
});

test('PDF incorpora os 10% somente nas peças sem alterar a mão de obra',()=>{
  const originalDocument=globalThis.document;
  globalThis.document={createElement:()=>{
    const canvas={texts:[]};
    canvas.getContext=()=>({font:'',fillStyle:'',strokeStyle:'',lineWidth:0,drawImage(){},fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(value){canvas.texts.push(String(value))},measureText(value){return{width:String(value).length*9}}});
    return canvas;
  }};
  try{
    const report={...order,number:'0099',created:'2026-10-08T10:00:00',surchargeRate:.10,labor:100,partsValue:20,discount:0,total:122,complaint:'Teste',client:{name:'Cliente'},vehicle:{model:'Carro'},checklist:[],budget:{services:[{description:'Serviço teste',value:100}],parts:[{description:'Peça teste',quantity:1,value:20}]}};
    const texts=drawReport(report,{}).flatMap(page=>page.texts);
    assert.ok(texts.includes('R$ 100,00')||texts.includes('R$ 100,00'));
    assert.ok(texts.includes('R$ 22,00')||texts.includes('R$ 22,00'));
    assert.ok(texts.includes('VALOR TOTAL: R$ 122,00')||texts.includes('VALOR TOTAL: R$ 122,00'));
    assert.equal(texts.some(text=>text.includes('Acréscimo')),false);
  }finally{
    if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
  }
});

test('tabela de serviços que cabe na página seguinte não cria segundo campo',()=>{
  const originalDocument=globalThis.document;
  globalThis.document={createElement:()=>{
    const canvas={texts:[]};
    canvas.getContext=()=>({
      font:'',fillStyle:'',strokeStyle:'',lineWidth:0,
      drawImage(){},fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},
      fillText(value){canvas.texts.push(String(value))},
      measureText(value){return{width:String(value).length*9}}
    });
    return canvas;
  }};
  try{
    const services=Array.from({length:6},(_,index)=>({description:`Serviço teste ${index+1}`,value:100}));
    const parts=Array.from({length:6},(_,index)=>({description:`Peça teste ${index+1}`,quantity:1,value:20}));
    const report={...order,number:'0068',created:'2026-09-15T18:00:00',complaint:'Troca de óleo',client:{name:'Cliente teste'},vehicle:{model:'Carro teste'},checklist:Array.from({length:12},(_,index)=>({label:`Item ${index+1}`,ok:false})),budget:{services,parts}};
    const pages=drawReport(report,{});
    assert.ok(pages.length>=2);
    assert.equal(pages.flatMap(page=>page.texts).filter(text=>text==='SERVIÇOS ORÇADOS').length,1);
    assert.equal(pages.flatMap(page=>page.texts).filter(text=>text==='SERVIÇO / VALOR').length,0);
    const pageWithServices=pages.find(page=>page.texts.includes('SERVIÇOS ORÇADOS'));
    for(const service of services)assert.ok(pageWithServices.texts.includes(service.description));
  }finally{
    if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
  }
});
