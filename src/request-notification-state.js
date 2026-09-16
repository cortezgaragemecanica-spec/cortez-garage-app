export function isServiceQuotePendingForViewer(request,email){
  const viewer=String(email||'').trim().toLowerCase();
  if(request.viewedBy?.[viewer])return false;
  return request.individualNotifications===true||request.status==='Pendente';
}
