// Simulacao deterministica e stateless das viaturas da Brigada Militar (PM/RS).
//
// As viaturas se movem SOBRE RUAS REAIS de Porto Alegre: as poligonais em
// routes.json foram geradas pelo OSRM (algoritmos de caminho minimo —
// Dijkstra / Contraction Hierarchies — sobre o grafo viario), entao nenhuma
// viatura entra no Lago Guaiba. A posicao e funcao apenas do tempo, logo cada
// invocacao serverless calcula o mesmo ponto para um dado timestamp.

const ROUTES = require('./routes.json'); // [{id,name,coords:[[lat,lng],...]}]
const { generateFleet } = require('./fleet');
const { getTrafficFactor } = require('./traffic');

// Frota da Brigada Militar (PM/RS), gerada pelo modulo lib/fleet.js.
const VEHICLES = generateFleet();

// Epoca de referencia para o tempo decorrido ser administravel.
const EPOCH = new Date('2025-01-01T00:00:00Z').getTime();

function distanceKm(aLat, aLng, bLat, bLng) {
  const meanLat = ((aLat + bLat) / 2) * Math.PI / 180;
  const dLat = (bLat - aLat) * 111.32;
  const dLng = (bLng - aLng) * 111.32 * Math.cos(meanLat);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// Pre-calcula a distancia acumulada (km) ao longo de cada rota.
const ROUTE_META = ROUTES.map((r) => {
  const cum = [0];
  for (let i = 1; i < r.coords.length; i++) {
    const [la0, ln0] = r.coords[i - 1];
    const [la1, ln1] = r.coords[i];
    cum.push(cum[i - 1] + distanceKm(la0, ln0, la1, ln1));
  }
  return { coords: r.coords, cum, total: cum[cum.length - 1] };
});

// Interpola o ponto a `d` km do inicio da rota (com wrap no loop) e a direcao.
function pointAtDistance(meta, d) {
  const total = meta.total;
  d = ((d % total) + total) % total;
  const { cum, coords } = meta;

  // Busca binaria pelo primeiro indice com cum[i] >= d.
  let lo = 1, hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < d) lo = mid + 1; else hi = mid;
  }
  const i = lo;
  const segStart = cum[i - 1];
  const segEnd = cum[i];
  const t = segEnd > segStart ? (d - segStart) / (segEnd - segStart) : 0;

  const [la0, ln0] = coords[i - 1];
  const [la1, ln1] = coords[i];
  const lat = la0 + (la1 - la0) * t;
  const lng = ln0 + (ln1 - ln0) * t;

  // Direcao (azimute) a partir do norte.
  const dNorth = la1 - la0;
  const dEast = (ln1 - ln0) * Math.cos(lat * Math.PI / 180);
  let heading = Math.atan2(dEast, dNorth) * (180 / Math.PI);
  if (heading < 0) heading += 360;

  return { lat, lng, heading };
}

// Rota / velocidade / deslocamento inicial de cada viatura (deterministico).
function dynamics(vehicle) {
  const meta = ROUTE_META[(vehicle.seed - 1) % ROUTE_META.length];
  const baseSpeed = 32 + (vehicle.seed % 4) * 6; // 32..50 km/h
  const offsetKm = ((vehicle.seed * 0.37) % 1) * meta.total; // espalha na rota
  return { meta, baseSpeed, offsetKm };
}

function calculatePosition(vehicle, nowMs, trafficFactor) {
  const { meta, baseSpeed, offsetKm } = dynamics(vehicle);
  const elapsedH = (nowMs - EPOCH) / 3600000;
  const effectiveSpeed = trafficFactor != null ? baseSpeed * Math.min(trafficFactor, 1.2) : baseSpeed;
  const d = offsetKm + effectiveSpeed * elapsedH;
  const p = pointAtDistance(meta, d);

  return {
    id: vehicle.id,
    name: vehicle.name,
    type: vehicle.type,
    lat: p.lat,
    lng: p.lng,
    heading: Math.round(p.heading * 10) / 10,
    speed: Math.round(Math.max(8, effectiveSpeed) * 10) / 10,
    status: 'normal',
    lastUpdate: nowMs,
  };
}

/**
 * Retorna as viaturas com suas posicoes atuais (sobre as ruas).
 */
function getAllVehiclePositions() {
  const now = Date.now();
  return VEHICLES.map((v) => {
    const route = ROUTES[(v.seed - 1) % ROUTES.length];
    const factor = getTrafficFactor(route.id);
    return calculatePosition(v, now, factor);
  });
}

/**
 * Projeta a trajetoria futura da viatura ao longo da MESMA rota de rua
 * (usado pela "Onda de Cessao"). Retorna pontos ordenados a frente de `nowMs`.
 */
function calculateForecast(vehicle, nowMs, horizon = 30, stepSec = 2) {
  const { meta, baseSpeed, offsetKm } = dynamics(vehicle);
  const elapsedH = (nowMs - EPOCH) / 3600000;
  const d0 = offsetKm + baseSpeed * elapsedH;
  const points = [];
  for (let t = 0; t <= horizon; t += stepSec) {
    const d = d0 + baseSpeed * (t / 3600);
    const p = pointAtDistance(meta, d);
    points.push({ lat: p.lat, lng: p.lng, t });
  }
  return points;
}

module.exports = {
  distanceKm,
  calculatePosition,
  calculateForecast,
  getAllVehiclePositions,
  VEHICLES,
  ROUTES,
};
