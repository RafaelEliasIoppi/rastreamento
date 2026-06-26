// Dados de transito REAL via TomTom Traffic Flow API.
//
// Cache em escopo global do processo (sobrevive a cache-busting do require
// em local-server.js). A cada 5 minutos busca velocidades reais no ponto
// central de cada rota e retorna um fator de congestionamento (0..1).
// Degradacao graciosa: sem TOMTOM_KEY ou falha da API retorna 1.0.

const TOMTOM_FLOW = 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

const ROUTES = require('./routes.json');

// Cache global do processo — sobrevive a cache-busting do require em local-server.
global.__TRAFFIC_CACHE__ = global.__TRAFFIC_CACHE__ || new Map();
const cache = global.__TRAFFIC_CACHE__;

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

// Fator de transito sincrono — retorna o cache ou 1.0 se ainda nao carregou.
function getTrafficFactor(routeId) {
  if (!key()) return 1.0;
  const entry = getCache(routeId);
  return entry ? entry.factor : 1.0;
}

// Dados completos de transito para enriquecer resposta da API.
function getTrafficData(routeId) {
  if (!key()) return null;
  return getCache(routeId) || null;
}

// Busca um ponto na TomTom Traffic Flow API.
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
    return {
      currentSpeed: fsd.currentSpeed,
      freeFlowSpeed: fsd.freeFlowSpeed,
      confidence: fsd.confidence || 0,
    };
  } catch {
    return null;
  }
}

// Ponto central de uma rota (aproximadamente no meio do array de coords).
function midpointOfRoute(route) {
  const coords = route.coords;
  return coords[Math.floor(coords.length / 2)];
}

// Atualiza o cache para TODAS as rotas (chamado na inicializacao e a cada TTL).
async function refreshAllRoutes() {
  if (!key()) return;
  const results = await Promise.allSettled(
    ROUTES.map(async (route) => {
      const [lat, lng] = midpointOfRoute(route);
      const data = await fetchPoint(lat, lng);
      if (!data) {
        setCache(route.id, { factor: 1.0, currentSpeed: null, freeFlowSpeed: null });
        return;
      }
      const factor = Math.max(0.2, Math.min(1, data.currentSpeed / data.freeFlowSpeed));
      setCache(route.id, { factor, currentSpeed: data.currentSpeed, freeFlowSpeed: data.freeFlowSpeed });
    })
  );
}

// Inicializa o cache e agenda refresh periodico (funciona no local-server).
function init() {
  if (!key()) return;
  refreshAllRoutes();
  setInterval(refreshAllRoutes, CACHE_TTL);
}

init();

module.exports = { getTrafficFactor, getTrafficData, refreshAllRoutes, fetchPoint };
