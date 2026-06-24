const { getAllVehiclePositions } = require('../lib/simulation');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { sql } = require('../lib/db');

    if (req.method === 'POST') {
      const { vehicleId, message } = req.body || {};
      if (!vehicleId) {
        return res.status(400).json({ error: 'vehicleId is required' });
      }

      // Find vehicle current position from simulation
      const vehicles = getAllVehiclePositions();
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (!vehicle) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }

      const result = await sql`
        INSERT INTO emergencies (vehicle_id, vehicle_name, vehicle_type, lat, lng, message)
        VALUES (${vehicle.id}, ${vehicle.name}, ${vehicle.type}, ${vehicle.lat}, ${vehicle.lng}, ${message || 'Solicitacao de apoio!'})
        RETURNING *
      `;

      const entry = result[0];
      return res.status(201).json({
        id: entry.id,
        vehicleId: entry.vehicle_id,
        vehicleName: entry.vehicle_name,
        vehicleType: entry.vehicle_type,
        lat: entry.lat,
        lng: entry.lng,
        message: entry.message,
        timestamp: new Date(entry.created_at).getTime(),
      });
    }

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT * FROM emergencies
        ORDER BY created_at DESC
        LIMIT 20
      `;

      const entries = rows.map(r => ({
        id: r.id,
        vehicleId: r.vehicle_id,
        vehicleName: r.vehicle_name,
        vehicleType: r.vehicle_type,
        lat: r.lat,
        lng: r.lng,
        message: r.message,
        timestamp: new Date(r.created_at).getTime(),
      }));

      return res.status(200).json(entries);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Error in /api/emergency:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
