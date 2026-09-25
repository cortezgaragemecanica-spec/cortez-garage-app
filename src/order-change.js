const ROW_FIELDS=['numero','cliente_id','veiculo_id','reclamacao','diagnostico','observacoes','avarias','mecanico','status','mao_obra','valor_pecas','desconto','total','pagamento','checklist','data_entrada'];
const EXTRA_FIELDS=['signature','services','parts','budget','technicalReport','advances','advance','advancePayment','advanceAt','warranty','warrantyPayCommissions','client','vehicle'];
const AUDIT_FIELDS=new Set(['updatedAt','atualizado_em','updatedBy','createdBy']);

function normalized(value){
  if(value===null||value===undefined)return'';
  if(Array.isArray(value))return value.map(normalized);
  if(typeof value==='object')return Object.fromEntries(Object.keys(value).filter(key=>!AUDIT_FIELDS.has(key)).sort().map(key=>[key,normalized(value[key])]));
  return value;
}

export function orderContentFingerprint(row){
  const extras=row?.dados_extras||{},content=Object.fromEntries(ROW_FIELDS.map(key=>[key,row?.[key]]));
  content.dados_extras=Object.fromEntries(EXTRA_FIELDS.map(key=>[key,extras[key]]));
  return JSON.stringify(normalized(content));
}
