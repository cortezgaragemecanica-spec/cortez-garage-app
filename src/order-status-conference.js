// Confere o estado atual sem reaplicar uma etapa concluída.
export function approvalAction(current,request,reviewed){
 if(!current)throw new Error('O.S. não encontrada.');
 if(!['Pronto para entrega','Entregue'].includes(request.destino))throw new Error('Solicitação de status inválida.');
 if(current.status===request.destino||request.destino==='Pronto para entrega'&&current.status==='Entregue')return 'confirm';
 if(current.status==='Recusado')throw new Error('A O.S. foi recusada. Confira a situação antes de aprovar.');
 const expected=reviewed?.updatedAt||request.versao;
 if(!expected||new Date(current.updatedAt).getTime()!==new Date(expected).getTime())throw new Error('A O.S. mudou durante a conferência. Reabra a conferência para revisar os dados atuais.');
 if(request.destino==='Pronto para entrega')return 'ready';
 if(current.status!=='Pronto para entrega')throw new Error('A O.S. precisa estar pronta para entrega.');
 if(!request.pagamento?.cashPayment)throw new Error('Informe o pagamento antes de aprovar a entrega.');
 return 'deliver';
}
const processing=new Set();
export async function approveStatusConference(request,reviewed,operations){
 const key=request.setor+':'+request.os_id;
 if(processing.has(key))throw new Error('Esta O.S. já está sendo conferida.');
 processing.add(key);
 try{
  const current=await operations.readOrder(request.os_id,request.setor),action=approvalAction(current,request,reviewed);
  if(action==='ready')await operations.makeReady(current);
  if(action==='deliver'){
   const payment=request.pagamento;current.payment=payment.payment;
   await operations.recordDelivery(current,payment.cashPayment,payment.credit,payment.card);
   await operations.saveOrder(current);
   await operations.updateStatus(current.id,'Entregue');
  }
  await operations.resolveRequest(request.id,'Aprovado');
  return{action,changed:action!=='confirm'};
 }finally{processing.delete(key)}
}
