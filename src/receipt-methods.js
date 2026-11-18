export const RECEIPT_METHODS = ['Dinheiro','Pix BB','Pix ML','Cartão máquina Cielo','Cartão máquina Mercado Livre','Cartão máquina Rede Card (Luizinho)'];
const machines = {
 'Cartão máquina Cielo': { account:'Banco do Brasil', debit:2.5, credit:10 },
 'Cartão máquina Mercado Livre': { account:'Mercado Livre', debit:2.5, credit:10 },
 'Cartão máquina Rede Card (Luizinho)': { account:'Luizinho', debit:1.5, credit:5 },
};
export const isCardMachine = method => Object.hasOwn(machines,method);
export function machineSettlement(amount,method,type){
 const machine=machines[method];
 if(!machine)return null;
 if(!['Débito','Crédito'].includes(type))throw new Error('Selecione crédito ou débito.');
 const gross=Math.round(Number(amount)*100)/100;
 if(!Number.isFinite(gross)||gross<0)throw new Error('Valor inválido.');
 const rate=type==='Débito'?machine.debit:machine.credit;
 const fee=Math.round(gross*rate)/100;
 return {gross,fee,net:Math.round((gross-fee)*100)/100,rate,installments:1,account:machine.account,paymentType:method+' · '+type};
}
export function parseMachinePayment(payment){
 const method=RECEIPT_METHODS.find(item=>isCardMachine(item)&&String(payment).startsWith(item+' · '));
 return method?{method,type:String(payment).slice(method.length+3)}:null;
}
