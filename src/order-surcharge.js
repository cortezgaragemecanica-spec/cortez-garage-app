export const NEW_ORDER_SURCHARGE_RATE=.10;

const roundMoney=value=>Math.round((Number(value)||0)*100)/100;

export const normalizeSurchargeRate=value=>Math.min(1,Math.max(0,Number(value)||0));

export function calculateOrderTotals({labor=0,partsValue=0,discount=0,surchargeRate=0}={}){
  const base=roundMoney(Math.max(0,(Number(labor)||0)+(Number(partsValue)||0)-(Number(discount)||0)));
  const rate=normalizeSurchargeRate(surchargeRate);
  const surchargeAmount=roundMoney(base*rate);
  return{base,surchargeRate:rate,surchargeAmount,total:roundMoney(base+surchargeAmount)};
}

export const orderTotals=order=>calculateOrderTotals(order||{});
