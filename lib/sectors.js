// Gerador de setores de patrulhamento da Brigada Militar (PM/RS).
//
// Cada setor e a AREA de atuacao de uma viatura, derivada da sua rota de
// patrulha real (lib/routes.json): o poligono do setor e o casco convexo dos
// pontos de rua daquela rota. Isso liga frota -> rota -> setor e alimenta o
// mapa (desenhar setores) e a logica "qual setor responde a esta emergencia".

const ROUTES = require('./routes.json'); // [{id,name,coords:[[lat,lng],...]}]
const { generateFleet } = require('./fleet');

// Identidade visual/nome de cada setor (casado pelo id da rota).
const SECTOR_META = {
  centro:   { name: 'Setor Centro / Cidade Baixa',   color: '#00d4ff' },
  norte:    { name: 'Setor Norte (Assis Brasil)',    color: '#00ff88' },
  leste:    { name: 'Setor Leste (Partenon)',        color: '#ffb020' },
  ipiranga: { name: 'Setor Ipiranga (Arroio Diluvio)', color: '#ff6ec7' },
  moinhos:  { name: 'Setor Moinhos / Higienopolis',  color: '#a78bfa' },
  menino:   { name: 'Setor Menino Deus / Praia de Belas', color: '#ff3b3b' },
};

// --- geometria (lat = y, lng = x) ---

function centroid(points) {
  let la = 0, ln = 0;
  for (const [lat, lng] of points) { la += lat; ln += lng; }
  return [la / points.length, ln / points.length];
}

// Casco convexo (monotone chain). Entrada/saida em [lat,lng].
function convexHull(points) {
  const pts = points.map(([lat, lng]) => [lng, lat]); // -> [x,y]
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper).map(([x, y]) => [y, x]); // -> [lat,lng]
}

// Ponto-em-poligono (ray casting). polygon em [lat,lng].
function pointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const intersect = (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Gera os setores de patrulhamento (um por rota), ja vinculados a viatura
 * responsavel (mesma ordem da frota: rota i <-> viatura seed i+1).
 * @returns {{id,name,color,routeId,vehicleId,vehicleName,center,polygon}[]}
 */
function generateSectors() {
  const fleet = generateFleet();
  return ROUTES.map((r, i) => {
    const meta = SECTOR_META[r.id] || { name: 'Setor ' + r.id, color: '#00d4ff' };
    const vehicle = fleet.find((v) => v.seed === i + 1) || null;
    return {
      id: r.id,
      name: meta.name,
      color: meta.color,
      routeId: r.id,
      vehicleId: vehicle ? vehicle.id : null,
      vehicleName: vehicle ? vehicle.name : null,
      center: centroid(r.coords),
      polygon: convexHull(r.coords),
    };
  });
}

/**
 * Retorna o setor que contem o ponto (ou null). Util para decidir qual viatura
 * e responsavel por uma emergencia.
 */
function sectorForPoint(lat, lng, sectors = generateSectors()) {
  return sectors.find((s) => pointInPolygon(lat, lng, s.polygon)) || null;
}

module.exports = {
  generateSectors,
  sectorForPoint,
  convexHull,
  pointInPolygon,
  centroid,
  SECTOR_META,
};
