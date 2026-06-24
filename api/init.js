module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sql, isConfigured } = require('../lib/db');

    if (!isConfigured) {
      return res.status(200).json({ success: true, skipped: true, message: 'Banco nao configurado — rodando em modo simulacao' });
    }

    await sql`
      CREATE TABLE IF NOT EXISTS emergencies (
        id SERIAL PRIMARY KEY,
        vehicle_id TEXT NOT NULL,
        vehicle_name TEXT NOT NULL,
        vehicle_type TEXT NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    return res.status(200).json({ success: true, message: 'Database tables initialized' });
  } catch (err) {
    console.error('Error in /api/init:', err);
    return res.status(500).json({ error: 'Failed to initialize database', details: err.message });
  }
};
