export const CARD_FEE_RATES=Object.freeze({1:2.7,2:3.5,3:3.9,4:4.2,5:5.5,6:5.5,7:7.6,8:8.2,9:8.7,10:10.2});

const cents=value=>Math.max(0,Math.round((Number(value)||0)*100));
const moneyFromCents=value=>value/100;

export function cardFeeRate(installments){
  const count=Math.trunc(Number(installments));
  if(!CARD_FEE_RATES[count])throw new Error('Selecione o pagamento no cartao a vista ou de 2x a 10x.');
  return CARD_FEE_RATES[count];
}

export function calculateCardSettlement(amount,installments=1){
  const count=Math.trunc(Number(installments)),rate=cardFeeRate(count),grossCents=cents(amount),feeCents=Math.round(grossCents*rate/100),base=Math.floor(grossCents/count),remainder=grossCents-base*count;
  return{
    installments:count,
    rate,
    gross:moneyFromCents(grossCents),
    fee:moneyFromCents(feeCents),
    net:moneyFromCents(Math.max(0,grossCents-feeCents)),
    installmentAmounts:Array.from({length:count},(_,index)=>moneyFromCents(base+(index<remainder?1:0)))
  };
}

export const cardInstallmentLabel=installments=>Number(installments)===1?'À vista':`${Number(installments)}x`;
