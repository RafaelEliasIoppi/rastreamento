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
      const { sql } = require('../lib/db');
      const emergencies = await sql`
        SELECT vehicle_id FROM emergencies
        WHERE created_at > NOW() - INTERVAL '30 seconds'
      `;
      const emergencyIds = new Set(emergencies.map(e => e.vehicle_id));
      vehicles.forEach(v => {
        if (emergencyIds.has(v.id)) {
          v.status = 'emergency';
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
