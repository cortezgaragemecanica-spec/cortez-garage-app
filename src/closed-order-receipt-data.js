export function closedOrderReceiptData(order){
  const saved=order.closingReceipt||{},total=Math.max(0,Number(saved.total??order.total)||0),advance=Math.max(0,Number(saved.advance??order.advance)||0);
  const hasCreditData=saved.creditAmount!==undefined||order.closingCreditAmount!==undefined;
  const creditAmount=Math.max(0,Number(saved.creditAmount??order.closingCreditAmount)||0);
  const unknownCredit=!hasCreditData&&order.payment==='Pagamento a prazo';
  const receivedNow=unknownCredit?null:Math.max(0,Number(saved.receivedNow??(total-advance-creditAmount))||0);
  const paidTotal=receivedNow===null?null:Math.min(total,advance+receivedNow);
  return{
    total,advance,creditAmount,receivedNow,paidTotal,
    creditDue:saved.creditDue||order.closingCreditDueDate||'',
    paymentType:saved.paymentType||order.closingCashPayment||order.payment||'Não informada',
    paymentCondition:saved.paymentCondition||order.payment||'Não informada',
    closedAt:saved.closedAt||order.deliveredAt||order.updatedAt||new Date().toISOString(),
    unknownCredit
  };
}
