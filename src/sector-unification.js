// A unificação não migra nem reavalia registros históricos.
export const UNIFICATION_DATE='2026-11-26';
export const RESERVE_ACCOUNT='Reserva de comissões Nubank';
export const shopDate=value=>{if(/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return String(value);const date=new Date(value??Date.now());return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(date):''};
export const sectorsUnified=(value=new Date())=>shopDate(value)>=UNIFICATION_DATE;
export const unifiedNewOrder=order=>sectorsUnified(order?.created||new Date());
export function includeElectricalMovement(row){const cash=(row.category||row.categoria)==='Fluxo de caixa',date=cash?(row.dueDate||row.vencimento):(row.createdAt||row.criado_em);return Boolean(date)&&sectorsUnified(date)&&(cash||!row.dueDate&&!row.vencimento||sectorsUnified(row.dueDate||row.vencimento))}
export function combineFinance(main,electrical){const rows=new Map(main.map(row=>[row.id,row]));for(const row of electrical)if(includeElectricalMovement(row)&&!rows.has(row.id))rows.set(row.id,row);return [...rows.values()]}
