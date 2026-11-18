import {electricalTags} from './electrical-order-view.js?v=20261118-1';
import {itemSector} from './sector-order-data.js?v=20261105-2';

const normalize=value=>String(value||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
export function suggestedItemSector(item={},order={}){
 if(item.stockId||item.sectorManual)return itemSector(item,order);
 const description=normalize(item.description);
 if(/\btermina(?:l|is) (?:d[ae] )?direcao\b/.test(description))return 'mecanica';
 if(electricalTags(description).length)return 'auto_eletrica';
 const parts=(order.budget?.parts||[]).filter(part=>!part.refused);
 if(/^(?:mao de obra|instalacao|servico)(?: eletric[ao])?$/.test(description)&&parts.length&&parts.every(part=>suggestedItemSector(part,{...order,budget:{parts:[]}})==='auto_eletrica'))return 'auto_eletrica';
 return itemSector(item,order);
}
