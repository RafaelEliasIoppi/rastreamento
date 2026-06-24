// Deterministic vehicle simulation that works without persistent state.
// Uses time-based sine/cosine waves so every serverless invocation computes
// the same position for a given timestamp.

// Centro da simulação: Porto Alegre / RS
const CENTER = { lat: -30.0346, lng: -51.2177 };
const SPREAD = 0.04; // ~4.5 km

// Frota da Brigada Militar (Policia Militar do RS) — Porto Alegre.
const VEHICLES = [
  { id: 'RP-1490',  name: 'Radiopatrulha 1490', type: 'policia', seed: 1 },
  { id: 'RP-1495',  name: 'Radiopatrulha 1495', type: 'policia', seed: 2 },
  { id: 'FT-01',    name: 'Forca Tatica Alfa',  type: 'policia', seed: 3 },
  { id: 'FT-02',    name: 'Forca Tatica Bravo', type: 'policia', seed: 4 },
  { id: 'ROCAM-01', name: 'ROCAM 01',           type: 'policia', seed: 5 },
  { id: 'CMD-01',   name: 'Comando CPC',        type: 'policia', seed: 6 },
];

// Reference epoch so elapsed time is manageable
const EPOCH = new Date('2025-01-01T00:00:00Z').getTime();

/**
 * Deterministically calculate a vehicle's position at the current moment.
 * Each vehicle traces a unique Lissajous-like loop around Porto Alegre using
 * different frequency ratios so paths never overlap exactly.
 */
/**
 * Pure position of a vehicle at a given number of seconds since EPOCH.
 * Shared by the live position and the future-trajectory forecast so both
 * trace exactly the same Lissajous curve.
 */
function rawPosition(vehicle, elapsedSec) {
  const s = vehicle.seed;

  // Unique frequencies per vehicle (radians per second)
  const freqLat1 = 0.005 + s * 0.0013;
  const freqLng1 = 0.007 + s * 0.0011;
  const freqLat2 = 0.003 + s * 0.0009;
  const freqLng2 = 0.004 + s * 0.0007;

  // Phase offsets based on seed
  const phaseLat = s * 1.1;
  const phaseLng = s * 0.7;

  // Combine two sine waves for more organic movement
  const latOffset = (
    Math.sin(elapsedSec * freqLat1 + phaseLat) * 0.6 +
    Math.sin(elapsedSec * freqLat2 + phaseLat * 2) * 0.4
  ) * SPREAD;

  const lngOffset = (
    Math.cos(elapsedSec * freqLng1 + phaseLng) * 0.6 +
    Math.cos(elapsedSec * freqLng2 + phaseLng * 2) * 0.4
  ) * SPREAD;

  return {
    lat: CENTER.lat + latOffset,
    lng: CENTER.lng + lngOffset,
  };
}

function calculatePosition(vehicle, nowMs) {
  const elapsed = (nowMs - EPOCH) / 1000; // seconds since epoch

  const { lat, lng } = rawPosition(vehicle, elapsed);

  // Compute heading from the derivative of position
  const dt = 0.5; // small time delta for derivative
  const future = rawPosition(vehicle, elapsed + dt);
  const futureLat = future.lat;
  const futureLng = future.lng;

  const dLat = futureLat - lat;
  const dLng = futureLng - lng;
  let heading = Math.atan2(dLng, dLat) * (180 / Math.PI);
  if (heading < 0) heading += 360;

  // Speed in km/h (approximate from derivative)
  const distKm = Math.sqrt(
    (dLat * 111.32) ** 2 +
    (dLng * 111.32 * Math.cos(lat * Math.PI / 180)) ** 2
  );
  const speed = (distKm / dt) * 3600; // km/h

  return {
    id: vehicle.id,
    name: vehicle.name,
    type: vehicle.type,
    lat,
    lng,
    heading: Math.round(heading * 10) / 10,
    speed: Math.round(Math.max(15, Math.min(90, speed)) * 10) / 10,
    status: 'normal',
    lastUpdate: nowMs,
  };
}

/**
 * Returns all 6 vehicles with their current calculated positions.
 */
function getAllVehiclePositions() {
  const now = Date.now();
  return VEHICLES.map(v => calculatePosition(v, now));
}

/**
 * Projects a vehicle's future trajectory (the "Onda de Cessão" / green
 * corridor). Samples the same deterministic curve at fixed steps ahead of
 * `nowMs`, returning ordered points the frontend can draw as a glowing path.
 *
 * @param {object} vehicle   one of VEHICLES (must have .seed)
 * @param {number} nowMs     reference timestamp (ms)
 * @param {number} horizon   how many seconds into the future to project
 * @param {number} stepSec   sampling interval in seconds
 * @returns {{lat:number,lng:number,t:number}[]} points (t = seconds ahead)
 */
function calculateForecast(vehicle, nowMs, horizon = 30, stepSec = 2) {
  const elapsed = (nowMs - EPOCH) / 1000;
  const points = [];
  for (let t = 0; t <= horizon; t += stepSec) {
    const { lat, lng } = rawPosition(vehicle, elapsed + t);
    points.push({ lat, lng, t });
  }
  return points;
}

module.exports = {
  rawPosition,
  calculatePosition,
  calculateForecast,
  getAllVehiclePositions,
  VEHICLES,
};
