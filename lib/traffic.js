// Dados de transito — prioriza TomTom Traffic Flow API (real), com fallback
// para simulacao por horario quando a API esta sem creditos ou indisponivel.
//
// Cache TomTom em escopo global (sobrevive a cache-busting em local-server.js).
// A cada 5 minutos busca velocidades reais no ponto central de cada rota.
// Se a API falhar, usa dados simulados baseados no horario atual.
// A simulacao considera: hora do dia (pico/ vale), dia da semana e uma semente
// por rota para variacao realista.

const TOMTOM_FLOW = 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json';
const CACHE_TTL = 5 * 60 * 1000;
const SIM_TTL = 60 * 1000; // 1 minuto — simulado atualiza por horario

const ROUTES = require('./routes.json');

global.__TRAFFIC_CACHE__ = global.__TRAFFIC_CACHE__ || new Map();
const cache = global.__TRAFFIC_CACHE__;

// -------- SIMULACAO DE TRANSITO POR HORARIO --------

// Fator de congestionamento baseado na hora do dia (0 = livre, 1 = parado).
// Usa uma curva senoidal suave inspirada em dados reais de mobilidade urbana.
function baseCongestionByHour(hour, isWeekend) {
  if (isWeekend) {
    // Fim de semana: transito mais leve e distribuido
    if (hour >= 8 && hour <= 11) return 0.15 + Math.sin((hour - 8) / 3 * Math.PI) * 0.1;
    if (hour >= 17 && hour <= 21) return 0.2 + Math.sin((hour - 17) / 4 * Math.PI) * 0.15;
    return 0.05;
  }
  // Dia util
  if (hour >= 7 && hour <= 9)    return 0.25 + Math.sin((hour - 7) / 2 * Math.PI) * 0.35; // pico manha
  if (hour >= 11 && hour <= 13)  return 0.2 + Math.sin((hour - 11) / 2 * Math.PI) * 0.2;  // almoco
  if (hour >= 17 && hour <= 19)  return 0.3 + Math.sin((hour - 17) / 2 * Math.PI) * 0.4; // pico tarde
  if (hour >= 6 && hour < 7)     return 0.05 + (hour - 6) * 0.2;                         // pre-pico
  if (hour >= 9 && hour < 11)    return 0.35 - (hour - 9) * 0.1;                         // pos-pico manha
  if (hour >= 13 && hour < 17)   return 0.15 + (hour - 13) * 0.02;                       // tarde
  if (hour >= 19 && hour < 22)   return 0.2 - (hour - 19) * 0.05;                        // noite
  return 0.05; // madrugada
}

// Variacao por rota: cada rota tem perfil de transito diferente (+/- 0.15).
function routeCongestionOffset(routeId) {
  const seeds = { centro: 0.08, norte: -0.05, leste: 0.12, ipiranga: -0.1, moinhos: 0.15, menino: -0.08 };
  return seeds[routeId] || 0;
}

// Velocidade de referencia (free flow) para cada rota (km/h).
function routeFreeFlow(routeId) {
  const speeds = { centro: 45, norte: 55, leste: 50, ipiranga: 60, moinhos: 40, menino: 50 };
  return speeds[routeId] || 50;
}

function simulatedTraffic(routeId) {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const base = baseCongestionByHour(hour, isWeekend);
  const offset = routeCongestionOffset(routeId);
  const congestion = Math.max(0, Math.min(0.9, base + offset));
  const freeFlowSpeed = routeFreeFlow(routeId);
  const currentSpeed = Math.round(freeFlowSpeed * (1 - congestion) * 10) / 10;
  const factor = Math.max(0.2, Math.min(1, currentSpeed / freeFlowSpeed));
  return { factor, currentSpeed, freeFlowSpeed, congestion, simulated: true };
}

// -------- TOMTOM (real) --------

function key() {
  return process.env.TOMTOM_KEY || '';
}

function getCache(routeId) {
  const entry = cache.get(routeId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) return null;
  return entry;
}

function setCache(routeId, data) {
  cache.set(routeId, { ...data, timestamp: Date.now() });
}

// Usa simulado se o cache TomTom estiver vazio ou expirado.
function getTrafficFactor(routeId) {
  const entry = key() ? getCache(routeId) : null;
  if (entry && entry.currentSpeed != null) return entry.factor;
  return simulatedTraffic(routeId).factor;
}

function getTrafficData(routeId) {
  const entry = key() ? getCache(routeId) : null;
  if (entry && entry.currentSpeed != null) return entry;
  return simulatedTraffic(routeId);
}

async function fetchPoint(lat, lng) {
  const k = key();
  if (!k) return null;
  const url = `${TOMTOM_FLOW}?point=${lat},${lng}&key=${k}&unit=KMPH`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    const fsd = data && data.flowSegmentData;
    if (!fsd || fsd.roadClosure || !fsd.currentSpeed || !fsd.freeFlowSpeed) return null;
    return { currentSpeed: fsd.currentSpeed, freeFlowSpeed: fsd.freeFlowSpeed, confidence: fsd.confidence || 0 };
  } catch {
    return null;
  }
}

function midpointOfRoute(route) {
  return route.coords[Math.floor(route.coords.length / 2)];
}

async function refreshAllRoutes() {
  if (!key()) return;
  await Promise.allSettled(
    ROUTES.map(async (route) => {
      const [lat, lng] = midpointOfRoute(route);
      const data = await fetchPoint(lat, lng);
      if (!data) {
        const sim = simulatedTraffic(route.id);
        setCache(route.id, { factor: sim.factor, currentSpeed: sim.currentSpeed, freeFlowSpeed: sim.freeFlowSpeed, simulated: true });
        return;
      }
      const factor = Math.max(0.2, Math.min(1, data.currentSpeed / data.freeFlowSpeed));
      setCache(route.id, { factor, currentSpeed: data.currentSpeed, freeFlowSpeed: data.freeFlowSpeed, simulated: false });
    })
  );
}

function init() {
  if (!key()) return;
  refreshAllRoutes();
  setInterval(refreshAllRoutes, CACHE_TTL);
}

init();

module.exports = { getTrafficFactor, getTrafficData, refreshAllRoutes, fetchPoint };
