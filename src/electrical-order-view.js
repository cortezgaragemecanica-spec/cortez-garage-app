import { projectOrderForSector } from './sector-order-data.js?v=20261105-2';

const ELECTRICAL_TAGS = [
  ['Lâmpada', /\blampadas?\b/],
  ['H7', /\bh7\b/],
  ['H4', /\bh4\b/],
  ['Polos', /\b(?:um|dois|1|2) polos?\b/],
  ['Pingo', /\bpingos?\b/],
  ['Fusível', /\bfusiv(?:el|eis)\b/],
  ['Terminal', /\btermina(?:l|is)\b/],
  ['Motor de arranque', /\bmotor (?:de arranque|de partida)\b/],
  ['Alternador', /\balternador(?:es)?\b/],
  ['Regulador de voltagem', /\bregulador de (?:voltagem|tensao)\b/],
  ['Porta-escovas', /\bporta escovas?\b/],
  ['Campo', /\bcampo\b/],
  ['Induzido', /\binduzidos?\b/],
  ['Máquina de vidro', /\bmaquinas? (?:de|do) vidro\b/],
  ['Alarme', /\balarmes?\b/],
  ['Buzina', /\bbuzinas?\b/],
  ['Sensor de ABS', /\bsensores? (?:de |do )?abs\b|\bsensor (?:de |do )?abs\b/],
  ['Chicote', /\bchicotes?\b/],
  ['Painel', /\bpaine(?:l|is)\b/],
  ['Bomba de combustível', /\bbombas? (?:de|do) combustivel\b/],
  ['Boia do tanque', /\bboias? (?:do |de )?tanque\b/],
  ['Relé', /\breles?\b/],
  ['Iluminação', /\b(?:farol|farois|lanternas?|led|xenon)\b/],
  ['Bateria', /\bbaterias?\b/],
  ['Elétrica', /\b(?:eletric[ao]s?|curto circuito|aterramento|conectores?|conector|solenoides?)\b/],
];

export function electricalTags(description) {
  const text = String(description ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return ELECTRICAL_TAGS.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

export function electricalOrderView(order) {
  const budget = order.budget || {};
  const classify = item => {
    const tags = electricalTags(item.description);
    const electrical = item.sector === 'auto_eletrica' || (!item.stockId && tags.length > 0) ||
      (!item.sector && (order.sourceSector === 'auto_eletrica' || order.sector === 'auto_eletrica'));
    return { ...item, tags, sector: electrical ? 'auto_eletrica' : 'mecanica' };
  };
  const parts = (budget.parts || []).map(classify);
  const services = (budget.services || []).map(classify);
  if (![...parts, ...services].some(item => item.sector === 'auto_eletrica' && !item.refused)) return null;
  const projection = projectOrderForSector({ ...order, budget: { ...budget, parts, services } }, 'auto_eletrica');
  return {
    ...projection,
    budget: {
      ...projection.budget,
      parts: parts.filter(item => item.sector === 'auto_eletrica'),
      services: services.filter(item => item.sector === 'auto_eletrica'),
    },
  };
}
