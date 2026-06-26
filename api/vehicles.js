const { getAllVehiclePositions } = require('../lib/simulation');

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

  try {
    const vehicles = getAllVehiclePositions();

    // Check DB for active emergencies (within last 30 seconds)
    try {
      const { sql, isConfigured } = require('../lib/db');
      if (!isConfigured) return res.status(200).json(vehicles);
      const emergencies = await sql`
        SELECT vehicle_id, lat, lng FROM emergencies
        WHERE created_at > NOW() - INTERVAL '30 seconds'
      `;
      // Ultimo registro por viatura (a tabela grava a posicao do chamado).
      const frozen = new Map();
      emergencies.forEach(e => frozen.set(e.vehicle_id, e));
      vehicles.forEach(v => {
        const e = frozen.get(v.id);
        if (e) {
          // ALTITUDE DO CONGELAMENTO (lado servidor, so COM banco): a VTR em
          // emergencia "parou" no local do chamado e aguarda apoio. Emitimos a
          // posicao congelada — nao a de patrulha — para que qualquer cliente
          // (mesmo recem-carregado) e os derivados fiquem consistentes.
          v.status = 'emergency';
          if (e.lat != null && e.lng != null) {
            v.lat = Number(e.lat);
            v.lng = Number(e.lng);
          }
        }
      });
    } catch (dbErr) {
      // DB might not be configured yet — continue with normal statuses
    }

    return res.status(200).json(vehicles);
  } catch (err) {
    console.error('Error in /api/vehicles:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
