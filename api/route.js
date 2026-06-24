// GET /api/route?from=LAT,LNG&to=LAT,LNG
// Calcula a MENOR rota considerando o TRANSITO ATUAL (TomTom Routing API).
// A chave (TOMTOM_KEY) fica SO no servidor — nunca vai pro frontend.
//
// Degradacao graciosa (como o Neon): sem TOMTOM_KEY, responde
// { configured:false } e o frontend cai no roteamento OSRM (sem transito).

const { buildRouteUrl, parseRoute } = require('../lib/tomtom');

function parseLatLng(s) {
  if (!s) return null;
  const [lat, lng] = String(s).split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.TOMTOM_KEY;
  if (!key) {
    // Sem chave: modo simulacao/OSRM. Nao e erro.
    return res.status(200).json({ configured: false });
  }

  const from = parseLatLng(req.query.from);
  const to = parseLatLng(req.query.to);
  if (!from || !to) {
    return res.status(400).json({ error: 'Parametros from/to invalidos (use LAT,LNG)' });
  }

  try {
    const url = buildRouteUrl(from, to, key);
    const resp = await fetch(url);
    if (!resp.ok) {
      // Falha do provedor: frontend faz fallback pro OSRM.
      return res.status(200).json({ configured: false, error: 'tomtom ' + resp.status });
    }
    const data = await resp.json();
    const route = parseRoute(data);
    return res.status(200).json({ configured: true, provider: 'tomtom', ...route });
  } catch (err) {
    console.error('Error in /api/route:', err);
    return res.status(200).json({ configured: false, error: 'route_failed' });
  }
};
