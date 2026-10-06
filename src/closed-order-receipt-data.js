export function closedOrderReceiptData(order){
  const saved=order.closingReceipt||{},warranty=Boolean(saved.warranty??order.warranty),total=Math.max(0,Number(saved.total??order.total)||0),advance=warranty?0:Math.max(0,Number(saved.advance??order.advance)||0);
  const hasCreditData=saved.creditAmount!==undefined||order.closingCreditAmount!==undefined;
  const creditAmount=warranty?0:Math.max(0,Number(saved.creditAmount??order.closingCreditAmount)||0);
  const unknownCredit=!warranty&&!hasCreditData&&order.payment==='Pagamento a prazo';
  const receivedNow=warranty?0:unknownCredit?null:Math.max(0,Number(saved.receivedNow??(total-advance-creditAmount))||0);
  const cardInstallments=warranty?0:Math.max(0,Math.trunc(Number(saved.cardInstallments)||0)),cardFeeRate=cardInstallments?Math.max(0,Number(saved.cardFeeRate)||0):0,cardFeeAmount=cardInstallments?Math.max(0,Number(saved.cardFeeAmount)||0):0,netReceived=receivedNow===null?null:Math.max(0,Number(saved.netReceived??receivedNow)||0);
  const paidTotal=warranty?0:receivedNow===null?null:Math.min(total,advance+receivedNow);
  const installments=warranty?[]:Array.isArray(saved.installments)?saved.installments:Array.isArray(order.closingInstallments)?order.closingInstallments:creditAmount?[{number:1,amount:creditAmount,dueDate:saved.creditDue||order.closingCreditDueDate||''}]:[];
  return{
    total,advance,creditAmount,receivedNow,netReceived,paidTotal,warranty,installments,installmentCount:installments.length,cardInstallments,cardFeeRate,cardFeeAmount,
    creditDue:saved.creditDue||order.closingCreditDueDate||'',
    paymentType:warranty?'Garantia · sem cobrança':saved.paymentType||order.closingCashPayment||order.payment||'Não informada',
    paymentCondition:warranty?'Garantia · sem cobrança':saved.paymentCondition||order.payment||'Não informada',
    closedAt:saved.closedAt||order.deliveredAt||order.updatedAt||new Date().toISOString(),
    unknownCredit
  };
}
