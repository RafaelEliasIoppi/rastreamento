// GET /api/forecast?vehicleId=ID&nowMs=TS
// Retorna a trajetoria futura da viatura SOBRE AS RUAS (lib/routes.json),
// usada pela "Onda de Cessao". Sem isso o frontend projetava em linha reta,
// o que podia jogar o corredor dentro do Lago Guaiba (BUG GRAVE).

const { calculateForecast, VEHICLES } = require('../lib/simulation');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const vehicleId = req.query.vehicleId;
    const nowMs = parseInt(req.query.nowMs, 10) || Date.now();
    const vehicle = VEHICLES.find((v) => v.id === vehicleId);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    const points = calculateForecast(vehicle, nowMs);
    return res.status(200).json({ vehicleId, points });
  } catch (err) {
    console.error('Error in /api/forecast:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
