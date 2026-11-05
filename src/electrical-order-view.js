import { projectOrderForSector } from './sector-order-data.js?v=20261105-2';

const ELECTRICAL_TAGS = [
  ['Lâmpada', /\blampadas?\b/],
  ['H7', /\bh7\b/],
  ['H4', /\bh4\b/],
  ['Polos', /\b(?:um|dois|1|2) polos?\b/],
  ['Pingo', /\bpingos?\b/],
  ['Fusível', /\bfusiv(?:el|eis)\b/],
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

const normalizeDescription = description => String(description ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const steeringTerminal = /\btermina(?:l|is) (?:d[ae] )?direcao\b/;

export function electricalTags(description) {
  const text = normalizeDescription(description);
  if (steeringTerminal.test(text)) return [];
  return ELECTRICAL_TAGS.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

const ELECTRICAL_START_DATE = '2026-11-05';
const shopDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' });

function closedBeforeElectricalStart(order) {
  if (order.status !== 'Entregue' && order.status !== 'Recusado') return false;
  const reference = order.status === 'Entregue' && order.deliveredAt ? order.deliveredAt : order.created;
  if (!reference) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(reference)) return reference < ELECTRICAL_START_DATE;
  const date = new Date(reference);
  return !Number.isFinite(date.getTime()) || shopDate.format(date) < ELECTRICAL_START_DATE;
}

export function electricalOrderView(order) {
  if (closedBeforeElectricalStart(order)) return null;
  const budget = order.budget || {};
  const classify = item => {
    if (steeringTerminal.test(normalizeDescription(item.description))) return { ...item, tags: [], sector: 'mecanica' };
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
